import { randomInt, randomUUID } from "node:crypto";
import {
  CUSTOMER_CANCELLABLE,
  ORDER_TRANSITIONS,
  priceCart,
  type Order,
  type OrderItem,
  type OrderStatus,
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
    paymentMethod: "cod",
    promisedMins: row.promisedMins,
    address: { tag: row.addressTag, line1: row.addressLine1, line2: row.addressLine2 },
    deliveryCode: showCode ? row.deliveryCode : null,
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

    const orderId = randomUUID();
    // Hold the stock first. If this fails nothing has been written and the customer sees why.
    await this.call(() =>
      this.clients.inventory.post("/internal/reservations", {
        warehouseId,
        reference: orderId,
        items: lines,
        ttlSeconds: 600,
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
            status: "confirmed",
            paymentMethod: "cod",
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
            confirmedAt: now,
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
            toStatus: "confirmed",
            actorId: identity.userId,
            actorRole: "customer",
            note: "Order placed (cash on delivery)",
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

    // Cash on delivery needs no payment step, so the hold becomes a sale straight away
    await this.call(() => this.clients.inventory.post(`/internal/reservations/${orderId}/commit`));

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
    if (from === input.to) return current; // repeating a step is harmless
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

    if (input.to === "cancelled") {
      // Sold stock goes back on the shelf. A failure is logged by the caller's retry, not hidden.
      await this.clients.inventory.post(`/internal/reservations/${id}/restock`).catch(() => {
        throw unavailable("The order was cancelled but its stock could not be returned yet.");
      });
      await this.clients.delivery
        .post(`/internal/deliveries/by-order/${id}/cancel`)
        .catch(() => undefined);
    }
    return updated;
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

  /** Every order, newest first, for admins and (for their own warehouse) managers. */
  async listAll(
    identity: Identity,
    filter: { status?: OrderStatus; warehouseId?: string; limit: number },
  ): Promise<(QueueOrder & { customerName: string })[]> {
    let query = this.db.selectFrom("orders.orders").selectAll();
    if (identity.role === "admin") {
      if (filter.warehouseId) query = query.where("warehouseId", "=", filter.warehouseId);
    } else {
      if (!identity.warehouseId) throw forbidden("You are not assigned to a warehouse.");
      query = query.where("warehouseId", "=", identity.warehouseId);
    }
    if (filter.status) query = query.where("status", "=", filter.status);
    const rows = await query.orderBy("placedAt", "desc").limit(filter.limit).execute();
    const orders = await this.hydrate(rows, () => false);
    const names = new Map(rows.map((r) => [r.id, r.customerName]));
    return orders.map(({ deliveryCode: _code, ...rest }) => ({
      ...rest,
      customerName: names.get(rest.id) ?? "",
    }));
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
        codPaise: row.totalPaise,
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
