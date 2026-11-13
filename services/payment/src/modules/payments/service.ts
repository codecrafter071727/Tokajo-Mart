import type { CheckoutResponse, Payment, PaymentStatus, VerifyPaymentBody } from "@qc/contracts";
import {
  InternalCallError,
  type Identity,
  type InternalClient,
  type Kysely,
} from "@qc/service-kit";
import type { Selectable } from "kysely";
import type { DB, PaymentsPayments } from "../../db/types.generated";
import { PaymentError } from "./errors";
import { RazorpayError, type RazorpayClient } from "./razorpay";
import { isValidCheckoutSignature, isValidWebhookSignature } from "./signatures";

type Row = Selectable<PaymentsPayments>;

type OrderInfo = {
  id: string;
  number: string;
  userId: string;
  status: string;
  paymentMethod: "cod" | "online";
  totalPaise: number;
  customerName: string;
  customerPhone: string;
};

export type PaymentConfig = {
  /** Null when online payments are not configured: checkout answers 503, COD keeps working */
  razorpay: RazorpayClient | null;
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  merchantName: string;
};

const toPayment = (row: Row): Payment => ({
  orderId: row.orderId,
  status: row.status as PaymentStatus,
  amountPaise: row.amountPaise,
  refundedPaise: row.refundedPaise,
  method: row.method,
  errorDescription: row.errorDescription,
});

type WebhookEntity = {
  id?: string;
  order_id?: string;
  payment_id?: string;
  amount?: number;
  method?: string;
  status?: string;
  error_code?: string | null;
  error_description?: string | null;
};
type WebhookBody = {
  event?: string;
  payload?: {
    payment?: { entity?: WebhookEntity };
    order?: { entity?: WebhookEntity };
    refund?: { entity?: WebhookEntity };
  };
};

export class PaymentService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly order: InternalClient,
    private readonly cfg: PaymentConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async orderInfo(orderId: string): Promise<OrderInfo> {
    try {
      return await this.order.get<OrderInfo>(`/internal/orders/${orderId}/payment-info`);
    } catch (error) {
      if (error instanceof InternalCallError && error.status === 404) {
        throw new PaymentError(404, "Order not found.");
      }
      throw new PaymentError(503, "We could not reach the order service. Please try again.");
    }
  }

  private async rowByOrder(orderId: string) {
    return this.db
      .selectFrom("payments.payments")
      .selectAll()
      .where("orderId", "=", orderId)
      .executeTakeFirst();
  }

  /** Whether the app should offer online payment. Never exposes keys. */
  config(): { onlineEnabled: boolean } {
    return { onlineEnabled: Boolean(this.cfg.razorpay && this.cfg.keyId && this.cfg.keySecret) };
  }

  /** Creates (or reuses) the Razorpay order for one of the customer's unpaid orders. */
  async checkout(identity: Identity, orderId: string): Promise<CheckoutResponse> {
    if (identity.role !== "customer") throw new PaymentError(403, "Only customers can pay.");
    const { razorpay, keyId } = this.cfg;
    if (!razorpay || !keyId) throw new PaymentError(503, "Online payments are not configured.");

    const order = await this.orderInfo(orderId);
    // Someone else's order looks the same as one that does not exist
    if (order.userId !== identity.userId) throw new PaymentError(404, "Order not found.");
    if (order.paymentMethod !== "online")
      throw new PaymentError(409, "This order is cash on delivery.");
    if (order.status !== "pending_payment") {
      throw new PaymentError(
        409,
        order.status === "expired"
          ? "The time to pay for this order ran out. Please place it again."
          : order.status === "cancelled"
            ? "This order was cancelled."
            : "This order is already paid.",
      );
    }

    let row = await this.rowByOrder(orderId);
    if (row && row.status !== "created" && row.status !== "failed") {
      throw new PaymentError(409, "This order is already paid.");
    }
    if (!row) {
      let created;
      try {
        created = await razorpay.createOrder({
          amountPaise: order.totalPaise,
          receipt: order.number,
          notes: { orderId },
        });
      } catch (error) {
        throw new PaymentError(
          502,
          error instanceof RazorpayError
            ? "Razorpay could not start the payment. Try again."
            : "Payment failed to start.",
        );
      }
      await this.db
        .insertInto("payments.payments")
        .values({
          orderId,
          userId: order.userId,
          amountPaise: order.totalPaise,
          razorpayOrderId: created.id,
        })
        .onConflict((oc) => oc.column("orderId").doNothing())
        .execute();
      row = (await this.rowByOrder(orderId)) as Row;
    }

    return {
      orderId,
      razorpayOrderId: row.razorpayOrderId,
      keyId,
      amountPaise: row.amountPaise,
      currency: "INR",
      name: this.cfg.merchantName,
      description: `Order ${order.number}`,
      prefill: { contact: order.customerPhone, name: order.customerName },
    };
  }

  /** The app's success callback. The signature proves Razorpay took this payment for this order. */
  async verify(identity: Identity, body: VerifyPaymentBody): Promise<Payment> {
    if (!this.cfg.keySecret) throw new PaymentError(503, "Online payments are not configured.");
    const row = await this.db
      .selectFrom("payments.payments")
      .selectAll()
      .where("razorpayOrderId", "=", body.razorpayOrderId)
      .executeTakeFirst();
    if (!row || row.userId !== identity.userId) throw new PaymentError(404, "Payment not found.");
    const ok = isValidCheckoutSignature(
      this.cfg.keySecret,
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
    );
    if (!ok) throw new PaymentError(400, "We could not verify this payment.");
    return toPayment(await this.capture(row.razorpayOrderId, body.razorpayPaymentId, null));
  }

  async status(identity: Identity, orderId: string): Promise<Payment> {
    const row = await this.rowByOrder(orderId);
    if (!row || (identity.role !== "admin" && row.userId !== identity.userId)) {
      throw new PaymentError(404, "Payment not found.");
    }
    return toPayment(row);
  }

  /**
   * Records the capture and confirms the order. Safe to call any number of times, from the app's
   * verify call and from webhooks in any order. If the order can no longer take the payment (it
   * expired or was cancelled while the customer paid), the money goes straight back.
   */
  private async capture(
    razorpayOrderId: string,
    paymentId: string,
    method: string | null,
  ): Promise<Row> {
    await this.db
      .updateTable("payments.payments")
      .set({
        status: "captured",
        razorpayPaymentId: paymentId,
        method,
        capturedAt: this.now(),
        errorCode: null,
        errorDescription: null,
      })
      .where("razorpayOrderId", "=", razorpayOrderId)
      .where("status", "in", ["created", "failed"])
      .execute();
    if (method) {
      await this.db
        .updateTable("payments.payments")
        .set({ method })
        .where("razorpayOrderId", "=", razorpayOrderId)
        .where("method", "is", null)
        .execute();
    }
    const row = await this.db
      .selectFrom("payments.payments")
      .selectAll()
      .where("razorpayOrderId", "=", razorpayOrderId)
      .executeTakeFirstOrThrow();
    if (row.status !== "captured") return row; // already refunded

    let orderStatus: string;
    try {
      const order = await this.order.post<{ status: string }>(
        `/internal/orders/${row.orderId}/payment-captured`,
      );
      orderStatus = order.status;
    } catch {
      throw new PaymentError(503, "Payment received. We are confirming your order, please wait.");
    }
    if (orderStatus === "expired" || orderStatus === "cancelled") {
      await this.refund(row.orderId);
      return (await this.rowByOrder(row.orderId)) as Row;
    }
    return row;
  }

  /** Full refund of a captured payment. Idempotent: a second call does nothing. */
  async refund(orderId: string): Promise<{ refunded: boolean }> {
    const row = await this.rowByOrder(orderId);
    if (!row || row.status !== "captured" || !row.razorpayPaymentId) return { refunded: false };
    if (!this.cfg.razorpay) throw new PaymentError(503, "Online payments are not configured.");

    // Claim it first, so two cancels at once cannot refund twice
    const claimed = await this.db
      .updateTable("payments.payments")
      .set({ status: "refunded", refundedPaise: row.amountPaise })
      .where("id", "=", row.id)
      .where("status", "=", "captured")
      .returning("id")
      .executeTakeFirst();
    if (!claimed) return { refunded: false };

    const amount = row.amountPaise - row.refundedPaise;
    try {
      const refund = await this.cfg.razorpay.refund(row.razorpayPaymentId, amount, { orderId });
      await this.db
        .insertInto("payments.refunds")
        .values({
          paymentId: row.id,
          razorpayRefundId: refund.id,
          amountPaise: refund.amount,
          status: refund.status === "processed" ? "processed" : "pending",
        })
        .onConflict((oc) => oc.column("razorpayRefundId").doNothing())
        .execute();
    } catch {
      // Put it back so the next cancel (or an admin) can try again
      await this.db
        .updateTable("payments.payments")
        .set({ status: "captured", refundedPaise: row.refundedPaise })
        .where("id", "=", row.id)
        .execute();
      throw new PaymentError(502, "Razorpay could not start the refund. Try again.");
    }
    return { refunded: true };
  }

  /** Razorpay webhooks. Verified over the raw body, and each event is handled once. */
  async webhook(rawBody: Buffer, signature: string | undefined, eventId: string | undefined) {
    if (!this.cfg.webhookSecret) throw new PaymentError(503, "Webhooks are not configured.");
    if (!signature || !isValidWebhookSignature(this.cfg.webhookSecret, rawBody, signature)) {
      throw new PaymentError(400, "Invalid signature.");
    }
    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as WebhookBody;
    } catch {
      throw new PaymentError(400, "Invalid body.");
    }
    const type = body.event ?? "unknown";

    if (eventId) {
      const fresh = await this.db
        .insertInto("payments.webhookEvents")
        .values({ eventId, type })
        .onConflict((oc) => oc.column("eventId").doNothing())
        .returning("eventId")
        .executeTakeFirst();
      if (!fresh) return { handled: false, duplicate: true };
    }

    const payment = body.payload?.payment?.entity;
    try {
      if (
        (type === "payment.captured" || type === "order.paid") &&
        payment?.id &&
        payment.order_id
      ) {
        await this.capture(payment.order_id, payment.id, payment.method ?? null);
      } else if (type === "payment.failed" && payment?.order_id) {
        await this.db
          .updateTable("payments.payments")
          .set({
            status: "failed",
            errorCode: payment.error_code ?? null,
            errorDescription: payment.error_description ?? null,
          })
          .where("razorpayOrderId", "=", payment.order_id)
          .where("status", "=", "created")
          .execute();
      } else if (type === "refund.processed" || type === "refund.failed") {
        const refund = body.payload?.refund?.entity;
        if (refund?.id) {
          await this.db
            .updateTable("payments.refunds")
            .set({ status: type === "refund.processed" ? "processed" : "failed" })
            .where("razorpayRefundId", "=", refund.id)
            .execute();
        }
      }
    } catch (error) {
      // Let Razorpay retry: forget we saw this event
      if (eventId) {
        await this.db.deleteFrom("payments.webhookEvents").where("eventId", "=", eventId).execute();
      }
      throw error;
    }
    return { handled: true, duplicate: false };
  }
}
