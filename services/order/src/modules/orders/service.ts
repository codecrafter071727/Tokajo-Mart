import { randomInt, randomUUID } from "node:crypto";
import {
  CUSTOMER_CANCELLABLE,
  ORDER_TRANSITIONS,
  priceCart,
  type AdminOrder,
  type AdminOrderDetail,
  type AdminOrdersQuery,
  type Order,
  type OrderHistoryEntry,
  type OrderItem,
  type PaymentBatchItem,
  type OrderStatus,
  type OrderSummary,
  type PlaceOrderBody,
  type QueueOrder,
} from "@qc/contracts";
import {
  assertWarehouseScope,
  InternalCallError,
  type Identity,
  type Kysely,
} from "@qc/service-kit";
import { sql, type Selectable } from "kysely";
import type { DB, OrdersOrderItems, OrdersOrders } from "../../db/types.generated";
import {
  type CatalogProduct,
  type Clients,
  type ResolveResult,
  type WarehouseInfo,
} from "./clients";
import { badRequest, conflict, forbidden, notFound, unavailable } from "./errors";

type OrderRow = Selectable<OrdersOrders>;
type ItemRow = Selectable<OrdersOrderItems>;

export const STAFF_ROLES = ["warehouse_staff", "warehouse_manager", "admin"] as const;

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/** Straight line distance in km, rounded to 100 m. Good enough for a rider payout and a label. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function toOrder(
  row: OrderRow,
  items: ItemRow[],
  rider: Order["rider"],
  showCode: boolean,
): Order {
  return {
    id: row.id,
    number: row.number,
    status: row.status as OrderStatus,
    warehouseId: row.warehouseId,
    items: items.map((i): OrderItem => ({
      productId: i.productId,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      unitPricePaise: i.unitPricePaise,
      mrpPaise: i.mrpPaise,
      emoji: i.emoji,
      imageUrl: i.imageUrl,
      picked: i.picked,
    })),
    itemTotalPaise: row.itemTotalPaise,
    mrpTotalPaise: row.mrpTotalPaise,
    savingsPaise: row.savingsPaise,
    deliveryFeePaise: row.deliveryFeePaise,
    handlingFeePaise: row.handlingFeePaise,
    tipPaise: row.tipPaise,
    totalPaise: row.totalPaise,
    paymentMethod: row.paymentMethod === "online" ? "online" : "cod",
    promisedMins: row.promisedMins,
    address: { tag: row.addressTag, line1: row.addressLine1, line2: row.addressLine2 },
    // An unpaid online order has no code yet: it only matters once the order is confirmed
    deliveryCode: showCode && !UNPAID.includes(row.status as OrderStatus) ? row.deliveryCode : null,
    rider,
    placedAt: row.placedAt.toISOString(),
    confirmedAt: iso(row.confirmedAt),
    packedAt: iso(row.packedAt),
    pickedUpAt: iso(row.pickedUpAt),
    deliveredAt: iso(row.deliveredAt),
    cancelledAt: iso(row.cancelledAt),
    cancelReason: row.cancelReason,
  };
}

/** Statuses of an online order that has not been paid (yet). */
const UNPAID: OrderStatus[] = ["pending_payment", "payment_failed", "expired"];

/** How long an online order waits for payment before its stock goes back on the shelf. */
export const PAYMENT_WINDOW_MINS = 15;

/** The timestamp column each status stamps when an order enters it. */
const STAMP: Partial<Record<OrderStatus, string>> = {
  confirmed: "confirmedAt",
  packing: "packingStartedAt",
  packed: "packedAt",
  picked_up: "pickedUpAt",
  out_for_delivery: "outForDeliveryAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
};

export type TransitionInput = {
  to: OrderStatus;
  actorId: string | null;
  actorRole: string;
  note?: string;
  riderId?: string;
};

export class OrderService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly clients: Clients,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // -------------------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------------------

  private async itemsOf(orderIds: string[]): Promise<Map<string, ItemRow[]>> {
    const map = new Map<string, ItemRow[]>();
    if (orderIds.length === 0) return map;
    const rows = await this.db
      .selectFrom("orders.orderItems")
      .selectAll()
      .where("orderId", "in", orderIds)
      .orderBy("createdAt")
      .orderBy("productId")
      .execute();
    for (const row of rows) map.set(row.orderId, [...(map.get(row.orderId) ?? []), row]);
    return map;
  }

  /** Rider name and phone for the customer. A failed lookup just hides the rider, never the order. */
  private async ridersFor(rows: OrderRow[]): Promise<Map<string, NonNullable<Order["rider"]>>> {
    const ids = [...new Set(rows.map((r) => r.riderId).filter((id): id is string => !!id))];
    const map = new Map<string, NonNullable<Order["rider"]>>();
    if (ids.length === 0) return map;
    try {
      const { items } = await this.clients.identity.get<{
        items: { id: string; name: string; phone: string | null; rating: number }[];
      }>(`/internal/riders/batch?ids=${ids.join(",")}`);
      for (const r of items) map.set(r.id, { name: r.name, phone: r.phone, rating: r.rating });
    } catch {
      // keep going without rider details
    }
    return map;
  }

  private async hydrate(rows: OrderRow[], showCodeFor: (row: OrderRow) => boolean) {
    const [items, riders] = await Promise.all([
      this.itemsOf(rows.map((r) => r.id)),
      this.ridersFor(rows),
    ]);
    return rows.map((row) =>
      toOrder(
        row,
        items.get(row.id) ?? [],
        row.riderId ? (riders.get(row.riderId) ?? null) : null,
        showCodeFor(row),
      ),
    );
  }

  private async rowById(id: string): Promise<OrderRow> {
    const row = await this.db
      .selectFrom("orders.orders")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) throw notFound();
    return row;
  }

  /** Who may see an order: its customer, staff of its warehouse, and admins. Others get a 404. */
  private async visibleRow(identity: Identity, id: string): Promise<OrderRow> {
    const row = await this.rowById(id);
    const owner = identity.role === "customer" && row.userId === identity.userId;
    const staff =
      (identity.role === "warehouse_staff" || identity.role === "warehouse_manager") &&
      identity.warehouseId === row.warehouseId;
    if (!owner && !staff && identity.role !== "admin") throw notFound();
    return row;
  }

  async get(identity: Identity, id: string): Promise<Order> {
    const row = await this.visibleRow(identity, id);
    const [order] = await this.hydrate([row], (r) => r.userId === identity.userId);
    return order as Order;
  }

  async listFor(identity: Identity, limit: number, userId?: string): Promise<Order[]> {
    let query = this.db.selectFrom("orders.orders").selectAll();
    if (identity.role === "admin") {
      if (userId) query = query.where("userId", "=", userId);
    } else {
      query = query.where("userId", "=", identity.userId);
    }
    const rows = await query.orderBy("placedAt", "desc").limit(limit).execute();
    return this.hydrate(rows, (r) => r.userId === identity.userId);
  }

  // -------------------------------------------------------------------------------------
  // Placing an order
  // -------------------------------------------------------------------------------------

  private async existingByKey(userId: string, key: string): Promise<OrderRow | undefined> {
    return this.db
      .selectFrom("orders.orders")
      .selectAll()
      .where("userId", "=", userId)
      .where("idempotencyKey", "=", key)
      .executeTakeFirst();
  }

  /**
   * Prices the order from the catalog (never from the client), finds a warehouse that can serve it,
   * holds the stock, then writes the order. Sending the same Idempotency-Key again returns the
   * order already made instead of making a second one.
   */
  async place(
    identity: Identity,
    idempotencyKey: string,
    body: PlaceOrderBody,
  ): Promise<{ order: Order; created: boolean }> {
    if (identity.role !== "customer") throw forbidden("Only customers can place orders.");

    const repeat = await this.existingByKey(identity.userId, idempotencyKey);
    if (repeat) {
      const [order] = await this.hydrate([repeat], () => true);
      return { order: order as Order, created: false };
    }

    // One line per product even if the client sent a product twice
    const quantities = new Map<string, number>();
    for (const line of body.items) {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
    }
    const lines = [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
    if (lines.some((l) => l.quantity > 100)) throw badRequest("Too many of one item.");

    const catalog = await this.call(() =>
      this.clients.catalog.get<{ items: CatalogProduct[] }>(
        `/internal/products?ids=${lines.map((l) => encodeURIComponent(l.productId)).join(",")}`,
      ),
    );
    const byId = new Map(catalog.items.map((p) => [p.id, p]));
    const unknown = lines.filter((l) => !byId.has(l.productId)).map((l) => l.productId);
    if (unknown.length > 0) throw conflict("Some items are no longer sold.", { unknown });

    const resolved = await this.call(() =>
      this.clients.inventory.post<ResolveResult>("/internal/serviceability/resolve", {
        lat: body.address.lat,
        lng: body.address.lng,
        items: lines,
      }),
    );
    if (!resolved.serviceable || !resolved.warehouseId) {
      throw conflict(
        resolved.reason === "ITEMS_UNAVAILABLE"
          ? "Some items are not available right now."
          : resolved.reason === "WAREHOUSE_CLOSED"
            ? "We are closed right now."
            : "We do not deliver to this address yet.",
        { reason: resolved.reason, unavailable: resolved.unavailable },
      );
    }
    const warehouseId = resolved.warehouseId;
    const promisedMins = resolved.etaMins ?? 15;

    const priced = lines.map((l) => {
      const product = byId.get(l.productId) as CatalogProduct;
      return { product, quantity: l.quantity };
    });
    const price = priceCart(
      priced.map(({ product, quantity }) => ({
        unitPricePaise: product.pricePaise,
        mrpPaise: product.mrpPaise,
        quantity,
      })),
      body.tipPaise ?? 0,
    );

    const online = body.payment === "online";
    const orderId = randomUUID();
    // Hold the stock first. If this fails nothing has been written and the customer sees why.
    await this.call(() =>
      this.clients.inventory.post("/internal/reservations", {
        warehouseId,
        reference: orderId,
        items: lines,
        // An online order holds stock while the customer pays, a little past the payment window
        ttlSeconds: online ? PAYMENT_WINDOW_MINS * 60 + 120 : 600,
      }),
    );

    let row: OrderRow;
    try {
      row = await this.db.transaction().execute(async (trx) => {
        const seq = await sql<{
          n: string;
        }>`select nextval('orders.order_number_seq') as n`.execute(trx);
        const now = this.now();
        const stamp = now.toISOString().slice(2, 10).replaceAll("-", "");
        const number = `QC-${stamp}-${String(seq.rows[0]?.n).padStart(5, "0")}`;
        const [customerName, customerPhone] = await this.customerContact(identity.userId);

        const inserted = await trx
          .insertInto("orders.orders")
          .values({
            id: orderId,
            number,
            userId: identity.userId,
            warehouseId,
            status: online ? "pending_payment" : "confirmed",
            paymentMethod: online ? "online" : "cod",
            itemTotalPaise: price.itemTotalPaise,
            mrpTotalPaise: price.mrpTotalPaise,
            savingsPaise: price.savingsPaise,
            deliveryFeePaise: price.deliveryFeePaise,
            handlingFeePaise: price.handlingFeePaise,
            tipPaise: price.tipPaise,
            totalPaise: price.totalPaise,
            promisedMins,
            deliveryCode: String(randomInt(0, 10_000)).padStart(4, "0"),
            customerName,
            customerPhone,
            addressTag: body.address.tag,
            addressLine1: body.address.line1,
            addressLine2: body.address.line2 ?? "",
            addressLat: body.address.lat,
            addressLng: body.address.lng,
            instructions: body.address.instructions ?? null,
            reservationId: null,
            idempotencyKey,
            placedAt: now,
            confirmedAt: online ? null : now,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("orders.orderItems")
          .values(
            priced.map(({ product, quantity }) => ({
              orderId,
              productId: product.id,
              name: product.name,
              unit: product.unit,
              quantity,
              unitPricePaise: product.pricePaise,
              mrpPaise: product.mrpPaise,
              emoji: product.emoji,
              imageUrl: product.imageUrl,
            })),
          )
          .execute();
        await trx
          .insertInto("orders.orderStatusHistory")
          .values({
            orderId,
            fromStatus: null,
            toStatus: online ? "pending_payment" : "confirmed",
            actorId: identity.userId,
            actorRole: "customer",
            note: online
              ? "Order placed, waiting for online payment"
              : "Order placed (cash on delivery)",
          })
          .execute();
        return inserted;
      });
    } catch (error) {
      // Nothing was saved: give the held stock back
      await this.clients.inventory
        .post(`/internal/reservations/${orderId}/release`)
        .catch(() => undefined);
      // Two identical requests raced and the other one won: return its order
      if ((error as { code?: string }).code === "23505") {
        const winner = await this.existingByKey(identity.userId, idempotencyKey);
        if (winner) {
          const [order] = await this.hydrate([winner], () => true);
          return { order: order as Order, created: false };
        }
      }
      throw error;
    }

    // Cash on delivery needs no payment step, so the hold becomes a sale straight away. An online
    // order keeps the hold until the payment is captured (or the window runs out).
    if (!online) {
      await this.call(() =>
        this.clients.inventory.post(`/internal/reservations/${orderId}/commit`),
      );
    }

    const [order] = await this.hydrate([row], () => true);
    return { order: order as Order, created: true };
  }

  private async customerContact(userId: string): Promise<[string, string]> {
    try {
      const user = await this.clients.identity.get<{ name: string; phone: string | null }>(
        `/internal/users/${userId}`,
      );
      return [user.name, user.phone ?? ""];
    } catch {
      return ["", ""];
    }
  }

  /** Calls another service and turns its failures into answers a customer can act on. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof InternalCallError) {
        if (error.status === 409) throw conflict(error.message, error.details);
        if (error.status >= 400 && error.status < 500) throw badRequest(error.message);
        throw unavailable("We could not reach a service we need. Please try again.");
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------------------
  // Moving an order through its states
  // -------------------------------------------------------------------------------------

  /**
   * The one place an order changes status. Checks the state machine, stamps the time, records who
   * did it, and does the side effects (stock back on cancel). The update is conditional on the old
   * status, so two people acting at once cannot both win.
   */
  async transition(id: string, input: TransitionInput): Promise<OrderRow> {
    const current = await this.rowById(id);
    const from = current.status as OrderStatus;
    if (from === input.to) {
      // Repeating a step is harmless. Repeating a cancel retries its side effects (all idempotent),
      // so an admin can finish a refund or restock that failed the first time.
      if (from === "cancelled") await this.afterCancel(current);
      return current;
    }
    if (!ORDER_TRANSITIONS[from].includes(input.to)) {
      throw conflict(
        `An order that is ${from.replaceAll("_", " ")} cannot become ${input.to.replaceAll("_", " ")}.`,
      );
    }

    const now = this.now();
    const stampColumn = STAMP[input.to];
    const updated = await this.db.transaction().execute(async (trx) => {
      const patch: Record<string, unknown> = { status: input.to };
      if (stampColumn) patch[stampColumn] = now;
      if (input.to === "cancelled") patch.cancelReason = input.note ?? null;
      if (input.riderId) patch.riderId = input.riderId;
      const row = await trx
        .updateTable("orders.orders")
        .set(patch)
        .where("id", "=", id)
        .where("status", "=", from)
        .returningAll()
        .executeTakeFirst();
      if (!row) return null;
      await trx
        .insertInto("orders.orderStatusHistory")
        .values({
          orderId: id,
          fromStatus: from,
          toStatus: input.to,
          actorId: input.actorId,
          actorRole: input.actorRole,
          note: input.note ?? null,
        })
        .execute();
      return row;
    });
    if (!updated) {
      const latest = await this.rowById(id);
      if (latest.status === input.to) return latest;
      throw conflict("This order was just changed by someone else. Refresh and try again.");
    }

    if (input.to === "cancelled") await this.afterCancel(updated);
    if (input.to === "expired") {
      // Never paid: the held stock simply goes back
      await this.clients.inventory
        .post(`/internal/reservations/${id}/release`)
        .catch(() => undefined);
    }
    if (input.to === "confirmed" && from === "pending_payment") {
      // Paid: the hold becomes a sale
      await this.call(() => this.clients.inventory.post(`/internal/reservations/${id}/commit`));
    }
    return updated;
  }

  /**
   * Stock back on the shelf (restock handles both a held and a sold reservation), the delivery
   * stopped, and for an online order a full refund. Every step is idempotent.
   */
  private async afterCancel(row: OrderRow): Promise<void> {
    await this.clients.inventory.post(`/internal/reservations/${row.id}/restock`).catch(() => {
      throw unavailable("The order was cancelled but its stock could not be returned yet.");
    });
    await this.clients.delivery
      .post(`/internal/deliveries/by-order/${row.id}/cancel`)
      .catch(() => undefined);
    if (row.paymentMethod === "online") {
      await this.clients.payment.post(`/internal/payments/orders/${row.id}/refund`).catch(() => {
        throw unavailable(
          "The order was cancelled but the refund could not be started yet. Try cancelling again.",
        );
      });
    }
  }

  /** Called by the payment service once Razorpay has the money. Safe to call twice. */
  async paymentCaptured(id: string): Promise<OrderRow> {
    const row = await this.rowById(id);
    if (row.paymentMethod !== "online") throw conflict("This order is not paid online.");
    if (row.status !== "pending_payment" && row.status !== "payment_failed") return row;
    if (row.status === "payment_failed") {
      await this.transition(id, { to: "pending_payment", actorId: null, actorRole: "system" });
    }
    return this.transition(id, {
      to: "confirmed",
      actorId: null,
      actorRole: "system",
      note: "Paid online",
    });
  }

  /** Online orders nobody paid for within the window expire and give their stock back. */
  async expireUnpaid(): Promise<number> {
    const cutoff = new Date(this.now().getTime() - PAYMENT_WINDOW_MINS * 60_000);
    const due = await this.db
      .selectFrom("orders.orders")
      .select("id")
      .where("status", "=", "pending_payment")
      .where("placedAt", "<", cutoff)
      .execute();
    let expired = 0;
    for (const { id } of due) {
      try {
        await this.transition(id, {
          to: "expired",
          actorId: null,
          actorRole: "system",
          note: "Not paid in time",
        });
        expired += 1;
      } catch {
        // paid or cancelled in the meantime
      }
    }
    return expired;
  }

  /** What the payment service needs to take a payment for an order. */
  async paymentInfo(id: string) {
    const row = await this.rowById(id);
    return {
      id: row.id,
      number: row.number,
      userId: row.userId,
      status: row.status as OrderStatus,
      paymentMethod: row.paymentMethod as "cod" | "online",
      totalPaise: row.totalPaise,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
    };
  }

  async cancel(identity: Identity, id: string, reason?: string): Promise<Order> {
    const row = await this.visibleRow(identity, id);
    const status = row.status as OrderStatus;
    if (identity.role === "customer" && !CUSTOMER_CANCELLABLE.includes(status)) {
      throw conflict("Your order is already being packed, so it cannot be cancelled now.");
    }
    if (identity.role !== "customer" && identity.role !== "admin") {
      throw forbidden("Only the customer or an admin can cancel an order.");
    }
    await this.transition(id, {
      to: "cancelled",
      actorId: identity.userId,
      actorRole: identity.role,
      note: reason ?? (identity.role === "customer" ? "Cancelled by the customer" : "Cancelled"),
    });
    return this.get(identity, id);
  }

  // -------------------------------------------------------------------------------------
  // Warehouse: queue, pick, pack
  // -------------------------------------------------------------------------------------

  private warehouseOf(identity: Identity, requested?: string): string {
    if (identity.role === "admin") {
      if (!requested) throw badRequest("Say which warehouse to show.");
      return requested;
    }
    if (!identity.warehouseId) throw forbidden("You are not assigned to a warehouse.");
    return identity.warehouseId;
  }

  async queue(identity: Identity, requestedWarehouse?: string): Promise<QueueOrder[]> {
    const warehouseId = this.warehouseOf(identity, requestedWarehouse);
    const rows = await this.db
      .selectFrom("orders.orders")
      .selectAll()
      .where("warehouseId", "=", warehouseId)
      .where("status", "in", ["confirmed", "packing", "packed"])
      .orderBy("placedAt")
      .execute();
    const orders = await this.hydrate(rows, () => false);
    return orders.map(({ deliveryCode: _code, ...rest }) => rest);
  }

  /** Payment status per online order. A failure hides the status, never the orders. */
  private async paymentStatuses(rows: OrderRow[]): Promise<Map<string, PaymentBatchItem>> {
    const ids = rows.filter((r) => r.paymentMethod === "online").map((r) => r.id);
    const map = new Map<string, PaymentBatchItem>();
    if (ids.length === 0) return map;
    try {
      const { items } = await this.clients.payment.get<{ items: PaymentBatchItem[] }>(
        `/internal/payments/batch?orderIds=${ids.join(",")}`,
      );
      for (const item of items) map.set(item.orderId, item);
    } catch {
      // keep going without payment status
    }
    return map;
  }

  /** Admins see every warehouse; a manager only theirs, whatever they ask for. */
  private adminScope(identity: Identity, requested?: string): string | undefined {
    if (identity.role === "admin") return requested;
    if (!identity.warehouseId) throw forbidden("You are not assigned to a warehouse.");
    return identity.warehouseId;
  }

  private async toAdminOrders(rows: OrderRow[]): Promise<AdminOrder[]> {
    const [orders, payments] = await Promise.all([
      this.hydrate(rows, () => false),
      this.paymentStatuses(rows),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return orders.map(({ deliveryCode: _code, ...rest }) => {
      const row = byId.get(rest.id) as OrderRow;
      return {
        ...rest,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        userId: row.userId,
        paymentStatus: payments.get(rest.id)?.status ?? null,
      };
    });
  }

  /** Every order, newest first, for admins and (for their own warehouse) managers. */
  async listAll(
    identity: Identity,
    filter: Omit<AdminOrdersQuery, "limit"> & { limit: number },
  ): Promise<AdminOrder[]> {
    let query = this.db.selectFrom("orders.orders").selectAll();
    const warehouseId = this.adminScope(identity, filter.warehouseId);
    if (warehouseId) query = query.where("warehouseId", "=", warehouseId);
    if (filter.status) query = query.where("status", "=", filter.status);
    if (filter.userId) query = query.where("userId", "=", filter.userId);
    if (filter.paymentMethod) query = query.where("paymentMethod", "=", filter.paymentMethod);
    if (filter.q) {
      const needle = filter.q.replace(/[\\%_]/g, (c) => `\\${c}`).toUpperCase();
      query = query.where("number", "like", `%${needle}%`);
    }
    if (filter.from)
      query = query.where("placedAt", ">=", new Date(`${filter.from}T00:00:00+05:30`));
    if (filter.to) {
      const end = new Date(new Date(`${filter.to}T00:00:00+05:30`).getTime() + 86_400_000);
      query = query.where("placedAt", "<", end);
    }
    if (filter.from && filter.to && filter.from > filter.to) {
      throw badRequest("The start date must not be after the end date.");
    }
    const rows = await query.orderBy("placedAt", "desc").limit(filter.limit).execute();
    return this.toAdminOrders(rows);
  }

  /** One order with everything the admin detail page shows. */
  async adminGet(identity: Identity, id: string): Promise<AdminOrderDetail> {
    const row = await this.rowById(id);
    const scope = this.adminScope(identity);
    if (scope && scope !== row.warehouseId) throw notFound();
    const [order] = await this.toAdminOrders([row]);
    return {
      ...(order as AdminOrder),
      addressLat: row.addressLat,
      addressLng: row.addressLng,
      instructions: row.instructions,
      outForDeliveryAt: row.outForDeliveryAt ? row.outForDeliveryAt.toISOString() : null,
    };
  }

  /** Every status change with who made it, oldest first. Admins, and managers of its warehouse. */
  async historyFor(identity: Identity, id: string): Promise<OrderHistoryEntry[]> {
    const row = await this.rowById(id);
    const scope = this.adminScope(identity);
    if (scope && scope !== row.warehouseId) throw notFound();
    const entries = await this.history(id);
    return entries.map((h) => ({
      fromStatus: (h.fromStatus as OrderStatus | null) ?? null,
      toStatus: h.toStatus as OrderStatus,
      actorRole: h.actorRole,
      actorId: h.actorId,
      note: h.note,
      at: h.createdAt.toISOString(),
    }));
  }

  /**
   * Numbers for the admin dashboard. All counting is done in SQL. Days are India local days, so an
   * order placed at 11pm India time counts on that day, not the next one in UTC.
   */
  async summary(
    identity: Identity,
    query: { from?: string; to?: string; warehouseId?: string },
  ): Promise<OrderSummary> {
    let warehouseId: string | null;
    if (identity.role === "admin") {
      warehouseId = query.warehouseId ?? null;
    } else {
      if (!identity.warehouseId) throw forbidden("You are not assigned to a warehouse.");
      warehouseId = identity.warehouseId;
    }

    const DAY = 86_400_000;
    const IST = 5.5 * 3_600_000;
    const dayOf = (date: Date) => new Date(date.getTime() + IST).toISOString().slice(0, 10);
    const startOf = (day: string) => new Date(`${day}T00:00:00+05:30`);
    const to = query.to ?? dayOf(this.now());
    const from = query.from ?? dayOf(new Date(startOf(to).getTime() - 6 * DAY));
    if (Number.isNaN(startOf(from).getTime()) || Number.isNaN(startOf(to).getTime())) {
      throw badRequest("Those dates are not valid.");
    }
    if (from > to) throw badRequest("The start date must not be after the end date.");
    const days = Math.round((startOf(to).getTime() - startOf(from).getTime()) / DAY) + 1;
    if (days > 366) throw badRequest("Pick a range of one year or less.");
    const start = startOf(from);
    const end = new Date(startOf(to).getTime() + DAY);

    const scope = (alias: string) =>
      sql`${sql.raw(alias)}.placed_at >= ${start} and ${sql.raw(alias)}.placed_at < ${end}
          ${warehouseId ? sql`and ${sql.raw(alias)}.warehouse_id = ${warehouseId}` : sql``}`;

    // The database client camel-cases raw column names too (product_id arrives as productId)
    const [statusRows, deliveredRows, dailyRows, productRows, warehouseRows] = await Promise.all([
      sql<{ status: string; n: string }>`
        select o.status, count(*) as n from orders.orders o where ${scope("o")} group by o.status
      `.execute(this.db),
      sql<{ gmv: string; avgMins: string | null; onTime: string }>`
        select coalesce(sum(o.total_paise), 0) as gmv,
               avg(extract(epoch from (o.delivered_at - o.placed_at)) / 60) as avg_mins,
               count(*) filter (
                 where o.delivered_at <= o.placed_at + make_interval(mins => o.promised_mins)
               ) as on_time
        from orders.orders o where o.status = 'delivered' and ${scope("o")}
      `.execute(this.db),
      sql<{ day: string; orders: string; gmv: string }>`
        select to_char((o.placed_at at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as day,
               count(*) as orders,
               coalesce(sum(o.total_paise) filter (where o.status = 'delivered'), 0) as gmv
        from orders.orders o where ${scope("o")} group by 1
      `.execute(this.db),
      sql<{ productId: string; name: string; quantity: string; revenue: string }>`
        select i.product_id, max(i.name) as name, sum(i.quantity) as quantity,
               sum(i.quantity * i.unit_price_paise) as revenue
        from orders.order_items i join orders.orders o on o.id = i.order_id
        where o.status not in ('cancelled', 'payment_failed', 'expired') and ${scope("o")}
        group by i.product_id order by revenue desc, i.product_id limit 10
      `.execute(this.db),
      identity.role === "admin"
        ? sql<{ warehouseId: string; orders: string; gmv: string }>`
            select o.warehouse_id, count(*) as orders,
                   coalesce(sum(o.total_paise) filter (where o.status = 'delivered'), 0) as gmv
            from orders.orders o where ${scope("o")} group by o.warehouse_id order by o.warehouse_id
          `.execute(this.db)
        : Promise.resolve({ rows: [] as { warehouseId: string; orders: string; gmv: string }[] }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of statusRows.rows) byStatus[r.status] = Number(r.n);
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const delivered = byStatus.delivered ?? 0;
    const cancelled = byStatus.cancelled ?? 0;
    const terminal =
      delivered + cancelled + (byStatus.payment_failed ?? 0) + (byStatus.expired ?? 0);
    const d = deliveredRows.rows[0];
    const gmv = Number(d?.gmv ?? 0);
    const round1 = (n: number) => Math.round(n * 10) / 10;

    const perDay = new Map(dailyRows.rows.map((r) => [r.day, r]));
    const daily = Array.from({ length: days }, (_, i) => {
      const date = dayOf(new Date(start.getTime() + i * DAY));
      const row = perDay.get(date);
      return { date, orders: Number(row?.orders ?? 0), gmvPaise: Number(row?.gmv ?? 0) };
    });

    return {
      from,
      to,
      warehouseId,
      totals: {
        orders: total,
        delivered,
        cancelled,
        active: total - terminal,
        gmvPaise: gmv,
        averageOrderPaise: delivered > 0 ? Math.round(gmv / delivered) : 0,
        cancelRatePercent: total > 0 ? round1((cancelled / total) * 100) : 0,
        averageDeliveryMins: delivered > 0 && d?.avgMins != null ? round1(Number(d.avgMins)) : null,
        onTimePercent: delivered > 0 ? round1((Number(d?.onTime ?? 0) / delivered) * 100) : null,
      },
      byStatus,
      daily,
      topProducts: productRows.rows.map((r) => ({
        productId: r.productId,
        name: r.name,
        quantity: Number(r.quantity),
        revenuePaise: Number(r.revenue),
      })),
      byWarehouse: warehouseRows.rows.map((r) => ({
        warehouseId: r.warehouseId,
        orders: Number(r.orders),
        gmvPaise: Number(r.gmv),
      })),
    };
  }

  private async staffRow(identity: Identity, id: string): Promise<OrderRow> {
    const row = await this.rowById(id);
    try {
      assertWarehouseScope(identity, row.warehouseId);
    } catch {
      throw notFound();
    }
    return row;
  }

  async startPacking(identity: Identity, id: string): Promise<QueueOrder> {
    await this.staffRow(identity, id);
    await this.transition(id, {
      to: "packing",
      actorId: identity.userId,
      actorRole: identity.role,
    });
    return this.queueOrder(identity, id);
  }

  async setPicked(identity: Identity, id: string, productId: string, picked: boolean) {
    const row = await this.staffRow(identity, id);
    if (row.status !== "packing") throw conflict("Start packing this order first.");
    const result = await this.db
      .updateTable("orders.orderItems")
      .set({ picked })
      .where("orderId", "=", id)
      .where("productId", "=", productId)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) throw notFound("That item is not on this order.");
    return this.queueOrder(identity, id);
  }

  /** Every item must be ticked. Then the order is packed and a delivery is created for riders. */
  async markPacked(identity: Identity, id: string): Promise<QueueOrder> {
    const row = await this.staffRow(identity, id);
    if (row.status === "packing") {
      const items = (await this.itemsOf([id])).get(id) ?? [];
      const missing = items.filter((i) => !i.picked).map((i) => i.productId);
      if (missing.length > 0)
        throw conflict("Tick every item before marking the order packed.", { missing });
      await this.transition(id, {
        to: "packed",
        actorId: identity.userId,
        actorRole: identity.role,
      });
    } else if (row.status !== "packed") {
      throw conflict("Start packing this order first.");
    }
    // Idempotent on the order id, so pressing the button again after a failure is safe
    await this.createDelivery(await this.rowById(id));
    return this.queueOrder(identity, id);
  }

  private async queueOrder(identity: Identity, id: string): Promise<QueueOrder> {
    const order = await this.get(identity, id);
    const { deliveryCode: _code, ...rest } = order;
    return rest;
  }

  private async createDelivery(row: OrderRow): Promise<void> {
    const [items, warehouse] = await Promise.all([
      this.itemsOf([row.id]).then((m) => m.get(row.id) ?? []),
      this.call(() =>
        this.clients.inventory.get<WarehouseInfo>(`/internal/warehouses/${row.warehouseId}`),
      ),
    ]);
    const km =
      row.addressLat !== null && row.addressLng !== null
        ? distanceKm(warehouse.lat, warehouse.lng, row.addressLat, row.addressLng)
        : 1;
    try {
      await this.clients.delivery.post("/internal/deliveries", {
        orderId: row.id,
        orderNumber: row.number,
        warehouseId: row.warehouseId,
        store: {
          name: warehouse.name,
          address: warehouse.name,
          lat: warehouse.lat,
          lng: warehouse.lng,
        },
        customer: {
          name: row.customerName,
          phone: row.customerPhone,
          address: [row.addressLine1, row.addressLine2].filter(Boolean).join(", "),
          lat: row.addressLat,
          lng: row.addressLng,
          instructions: row.instructions,
        },
        items: items.map((i) => ({
          id: i.productId,
          name: i.name,
          quantity: i.quantity,
          emoji: i.emoji,
        })),
        distanceKm: km,
        etaMins: row.promisedMins,
        tipPaise: row.tipPaise,
        // Cash to collect at the door, none when the customer already paid online
        codPaise: row.paymentMethod === "online" ? null : row.totalPaise,
        deliveryCode: row.deliveryCode,
      });
    } catch {
      throw unavailable("The order is packed but a rider could not be requested yet. Try again.");
    }
  }

  async history(id: string) {
    return this.db
      .selectFrom("orders.orderStatusHistory")
      .selectAll()
      .where("orderId", "=", id)
      .orderBy("id")
      .execute();
  }

  /** For the delivery service. Includes the delivery code, so it is internal only. */
  async internalGet(id: string): Promise<Order> {
    const row = await this.rowById(id);
    const [order] = await this.hydrate([row], () => true);
    return order as Order;
  }
}
