import type {
  AdminPayment,
  AdminPaymentDetail,
  AdminPaymentsResponse,
  AdminRefundBody,
  CheckoutResponse,
  Payment,
  PaymentBatchItem,
  PaymentStatus,
  Refund,
  VerifyPaymentBody,
} from "@qc/contracts";
import {
  InternalCallError,
  type Identity,
  type InternalClient,
  type Kysely,
} from "@qc/service-kit";
import { sql, type Selectable } from "kysely";
import type { DB, PaymentsPayments, PaymentsRefunds } from "../../db/types.generated";
import { PaymentError } from "./errors";
import { RazorpayError, type RazorpayClient } from "./razorpay";
import { isValidCheckoutSignature, isValidWebhookSignature } from "./signatures";

type Row = Selectable<PaymentsPayments>;
type RefundRow = Selectable<PaymentsRefunds>;

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
          orderNumber: order.number,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
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
    const refundable = row && (row.status === "captured" || row.status === "partially_refunded");
    if (!row || !refundable || !row.razorpayPaymentId) return { refunded: false };
    if (!this.cfg.razorpay) throw new PaymentError(503, "Online payments are not configured.");

    // Claim it first, so two cancels at once cannot refund twice
    const claimed = await this.db
      .updateTable("payments.payments")
      .set({ status: "refunded", refundedPaise: row.amountPaise })
      .where("id", "=", row.id)
      .where("status", "=", row.status)
      .where("refundedPaise", "=", row.refundedPaise)
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
          reason: "Order cancelled",
        })
        .onConflict((oc) => oc.column("razorpayRefundId").doNothing())
        .execute();
    } catch {
      // Put it back so the next cancel (or an admin) can try again
      await this.db
        .updateTable("payments.payments")
        .set({ status: row.status, refundedPaise: row.refundedPaise })
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

  // -------------------------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------------------------

  /** For the order service's admin views: payment status of several orders. */
  async batch(orderIds: string[]): Promise<PaymentBatchItem[]> {
    if (orderIds.length === 0) return [];
    const rows = await this.db
      .selectFrom("payments.payments")
      .select(["orderId", "status", "refundedPaise"])
      .where("orderId", "in", orderIds)
      .execute();
    return rows.map((r) => ({
      orderId: r.orderId,
      status: r.status as PaymentStatus,
      refundedPaise: r.refundedPaise,
    }));
  }

  private toAdmin(row: Row): AdminPayment {
    return {
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      userId: row.userId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      status: row.status as PaymentStatus,
      amountPaise: row.amountPaise,
      refundedPaise: row.refundedPaise,
      method: row.method,
      razorpayOrderId: row.razorpayOrderId,
      razorpayPaymentId: row.razorpayPaymentId,
      errorCode: row.errorCode,
      errorDescription: row.errorDescription,
      createdAt: row.createdAt.toISOString(),
      capturedAt: row.capturedAt ? row.capturedAt.toISOString() : null,
    };
  }

  /** Payments made before the order number was kept on the row get it filled in once. */
  private async backfill(rows: Row[]): Promise<Row[]> {
    return Promise.all(
      rows.map(async (row) => {
        if (row.orderNumber) return row;
        try {
          const info = await this.order.get<OrderInfo>(
            `/internal/orders/${row.orderId}/payment-info`,
          );
          const patch = {
            orderNumber: info.number,
            customerName: info.customerName,
            customerPhone: info.customerPhone,
          };
          await this.db
            .updateTable("payments.payments")
            .set(patch)
            .where("id", "=", row.id)
            .execute();
          return { ...row, ...patch };
        } catch {
          return row;
        }
      }),
    );
  }

  async adminList(filter: {
    status?: PaymentStatus;
    from?: string;
    to?: string;
    q?: string;
    limit: number;
    cursor?: string;
  }): Promise<AdminPaymentsResponse> {
    const start = filter.from ? new Date(`${filter.from}T00:00:00+05:30`) : null;
    const end = filter.to
      ? new Date(new Date(`${filter.to}T00:00:00+05:30`).getTime() + 86_400_000)
      : null;
    if (start && end && start >= end) {
      throw new PaymentError(400, "The start date must not be after the end date.");
    }
    const needle = filter.q ? `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;

    let base = this.db.selectFrom("payments.payments");
    if (filter.status) base = base.where("status", "=", filter.status);
    if (start) base = base.where("createdAt", ">=", start);
    if (end) base = base.where("createdAt", "<", end);
    if (needle) {
      base = base.where((eb) =>
        eb.or([
          eb("orderNumber", "ilike", needle),
          eb("razorpayOrderId", "ilike", needle),
          eb("razorpayPaymentId", "ilike", needle),
          eb("customerName", "ilike", needle),
          eb("customerPhone", "ilike", needle),
        ]),
      );
    }

    let page = base.selectAll();
    if (filter.cursor) {
      const [at, id] = Buffer.from(filter.cursor, "base64url").toString("utf8").split("|");
      const when = new Date(at ?? "");
      if (!id || Number.isNaN(when.getTime())) throw new PaymentError(400, "Invalid cursor.");
      page = page.where((eb) =>
        eb.or([
          eb("createdAt", "<", when),
          eb.and([eb("createdAt", "=", when), eb("id", "<", id)]),
        ]),
      );
    }
    const [rows, totals] = await Promise.all([
      page
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(filter.limit + 1)
        .execute(),
      base
        .select((eb) => [
          sql<string>`coalesce(sum(amount_paise) filter (where status in ('captured', 'partially_refunded', 'refunded')), 0)`.as(
            "capturedPaise",
          ),
          sql<string>`count(*) filter (where status in ('captured', 'partially_refunded', 'refunded'))`.as(
            "capturedCount",
          ),
          eb.fn.coalesce(eb.fn.sum<string>("refundedPaise"), sql<string>`0`).as("refundedPaise"),
          sql<string>`count(*) filter (where status = 'failed')`.as("failedCount"),
          // Checkouts still inside the 15 minute payment window; older ones were abandoned
          sql<string>`count(*) filter (where status = 'created' and created_at > now() - interval '15 minutes')`.as(
            "pendingCount",
          ),
        ])
        .executeTakeFirstOrThrow(),
    ]);
    const more = rows.length > filter.limit;
    const shown = await this.backfill(rows.slice(0, filter.limit));
    const last = shown.at(-1);
    return {
      items: shown.map((r) => this.toAdmin(r)),
      nextCursor:
        more && last
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`, "utf8").toString("base64url")
          : null,
      stats: {
        capturedPaise: Number(totals.capturedPaise),
        capturedCount: Number(totals.capturedCount),
        refundedPaise: Number(totals.refundedPaise),
        failedCount: Number(totals.failedCount),
        pendingCount: Number(totals.pendingCount),
      },
    };
  }

  private toRefund(row: RefundRow): Refund {
    return {
      id: row.id,
      razorpayRefundId: row.razorpayRefundId,
      amountPaise: row.amountPaise,
      status: row.status as Refund["status"],
      reason: row.reason,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async adminDetail(orderId: string): Promise<AdminPaymentDetail> {
    const found = await this.rowByOrder(orderId);
    if (!found) throw new PaymentError(404, "This order has no online payment.");
    const [row] = await this.backfill([found]);
    const refunds = await this.db
      .selectFrom("payments.refunds")
      .selectAll()
      .where("paymentId", "=", found.id)
      .orderBy("createdAt", "desc")
      .execute();
    const payment = row as Row;
    const capturable = payment.status === "captured" || payment.status === "partially_refunded";
    return {
      ...this.toAdmin(payment),
      refunds: refunds.map((r) => this.toRefund(r)),
      refundablePaise: capturable ? payment.amountPaise - payment.refundedPaise : 0,
    };
  }

  /**
   * An admin refund, full or partial. The amount is claimed on the payment row with one conditional
   * update first, so two admins (or an admin and a cancellation) can never refund more than was
   * paid. The Idempotency-Key makes a retried request return the same refund.
   */
  async adminRefund(
    identity: Identity,
    orderId: string,
    body: AdminRefundBody,
    idempotencyKey: string | undefined,
  ): Promise<AdminPaymentDetail> {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new PaymentError(400, "Send an Idempotency-Key header of 8 to 100 characters.");
    }
    const row = await this.rowByOrder(orderId);
    if (!row) throw new PaymentError(404, "This order has no online payment.");

    const seen = await this.db
      .selectFrom("payments.refunds")
      .select(["id", "paymentId", "status"])
      .where("idempotencyKey", "=", idempotencyKey)
      .executeTakeFirst();
    if (seen) {
      if (seen.paymentId !== row.id) {
        throw new PaymentError(409, "That Idempotency-Key was used for another refund.");
      }
      // A failed try gave its amount back, so retrying it with the same key is a fresh attempt
      if (seen.status !== "failed") return this.adminDetail(orderId);
      await this.db
        .updateTable("payments.refunds")
        .set({ idempotencyKey: null })
        .where("id", "=", seen.id)
        .execute();
    }

    if (row.status !== "captured" && row.status !== "partially_refunded") {
      throw new PaymentError(409, "Only a payment that was taken can be refunded.");
    }
    if (!row.razorpayPaymentId) throw new PaymentError(409, "This payment has no Razorpay id yet.");
    if (!this.cfg.razorpay) throw new PaymentError(503, "Online payments are not configured.");

    const remaining = row.amountPaise - row.refundedPaise;
    const amount = body.amountPaise ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new PaymentError(
        409,
        `Only ₹${(remaining / 100).toFixed(2).replace(/\.00$/, "")} can still be refunded.`,
      );
    }

    const claimed = await sql<{ id: string }>`
      update payments.payments
      set refunded_paise = refunded_paise + ${amount},
          status = case when refunded_paise + ${amount} = amount_paise
                        then 'refunded' else 'partially_refunded' end
      where id = ${row.id}::uuid
        and status in ('captured', 'partially_refunded')
        and refunded_paise + ${amount} <= amount_paise
      returning id
    `.execute(this.db);
    if (claimed.rows.length === 0) {
      throw new PaymentError(
        409,
        "Another refund just changed this payment. Refresh and try again.",
      );
    }
    const giveBack = async () => {
      await sql`
        update payments.payments
        set refunded_paise = refunded_paise - ${amount},
            status = case when refunded_paise - ${amount} = 0
                          then 'captured' else 'partially_refunded' end
        where id = ${row.id}::uuid
      `.execute(this.db);
    };

    let refundRow: { id: string } | undefined;
    try {
      refundRow = await this.db
        .insertInto("payments.refunds")
        .values({
          paymentId: row.id,
          amountPaise: amount,
          status: "pending",
          reason: body.reason,
          actorId: identity.userId,
          idempotencyKey,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
    } catch (error) {
      await giveBack();
      // The same request arrived twice at once and the other one won
      if ((error as { code?: string }).code === "23505") return this.adminDetail(orderId);
      throw error;
    }

    try {
      const refund = await this.cfg.razorpay.refund(row.razorpayPaymentId, amount, {
        orderId,
        reason: body.reason,
      });
      await this.db
        .updateTable("payments.refunds")
        .set({
          razorpayRefundId: refund.id,
          status: refund.status === "processed" ? "processed" : "pending",
        })
        .where("id", "=", refundRow.id)
        .execute();
    } catch {
      await giveBack();
      await this.db
        .updateTable("payments.refunds")
        .set({ status: "failed" })
        .where("id", "=", refundRow.id)
        .execute();
      throw new PaymentError(502, "Razorpay could not start the refund. Nothing was refunded.");
    }
    return this.adminDetail(orderId);
  }
}
