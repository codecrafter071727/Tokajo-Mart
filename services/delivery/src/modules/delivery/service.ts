import { randomInt } from "node:crypto";
import type {
  AdminRider,
  CreateDeliveryBody,
  Handover,
  RiderAction,
  RiderDelivery,
  RiderState,
} from "@qc/contracts";
import { InternalCallError, type InternalClient, type Kysely } from "@qc/service-kit";
import { sql, type Selectable } from "kysely";
import type { DB, DeliveryDeliveries } from "../../db/types.generated";
import { DeliveryError, HttpError } from "./errors";

type Row = Selectable<DeliveryDeliveries>;
type Item = { id: string; name: string; quantity: number; emoji: string };

/** How long a rider has to answer an offer before it moves on to someone else. */
export const OFFER_SECONDS = 25;
/** A rider who turned an offer down may be offered it again after this long. */
export const RETRY_AFTER_SECONDS = 60;
/** Wrong codes allowed at the handover or at the door before the delivery is locked. */
export const MAX_CODE_ATTEMPTS = 5;

/** Flat base plus a per kilometre amount, in paise. Real rates come from ops later. */
export const payoutFor = (km: number) => 3000 + Math.round(km * 800);

const ACTIVE = ["offered", "assigned", "at_store", "picked_up", "at_customer"] as const;

const NEXT: Record<RiderAction["type"], { from: Row["status"][]; to: string }> = {
  accept: { from: ["offered"], to: "assigned" },
  decline: { from: ["offered"], to: "unassigned" },
  arrive_store: { from: ["assigned"], to: "at_store" },
  pick_up: { from: ["at_store"], to: "picked_up" },
  arrive_customer: { from: ["picked_up"], to: "at_customer" },
  deliver: { from: ["at_customer"], to: "delivered" },
};

/** Midnight at the start of today in India, since riders think of "today" in local time. */
export function startOfIndiaDay(now: Date): Date {
  const offsetMs = 5.5 * 3600_000;
  const local = new Date(now.getTime() + offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMs);
}

const code = () => String(randomInt(0, 10_000)).padStart(4, "0");

export function toRiderDelivery(row: Row): RiderDelivery {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: (row.status === "unassigned" ? "offered" : row.status) as RiderDelivery["status"],
    store: { name: row.storeName, address: row.storeAddress, lat: row.storeLat, lng: row.storeLng },
    customer: {
      name: row.customerName,
      address: row.customerAddress,
      lat: row.customerLat,
      lng: row.customerLng,
      phone: row.customerPhone,
      instructions: row.instructions,
    },
    items: row.items as Item[],
    distanceKm: Number(row.distanceKm),
    etaMins: row.etaMins,
    payoutPaise: row.payoutPaise,
    tipPaise: row.tipPaise,
    codPaise: row.codPaise,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
  };
}

export class DeliveryService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly clients: { order: InternalClient; identity: InternalClient },
    private readonly now: () => Date = () => new Date(),
  ) {}

  // -------------------------------------------------------------------------------------
  // Created by the order service when the warehouse packs an order
  // -------------------------------------------------------------------------------------

  async create(body: CreateDeliveryBody): Promise<Row> {
    const inserted = await this.db
      .insertInto("delivery.deliveries")
      .values({
        orderId: body.orderId,
        orderNumber: body.orderNumber,
        warehouseId: body.warehouseId,
        storeName: body.store.name,
        storeAddress: body.store.address,
        storeLat: body.store.lat,
        storeLng: body.store.lng,
        customerName: body.customer.name,
        customerPhone: body.customer.phone,
        customerAddress: body.customer.address,
        customerLat: body.customer.lat,
        customerLng: body.customer.lng,
        instructions: body.customer.instructions,
        items: JSON.stringify(body.items),
        distanceKm: body.distanceKm,
        etaMins: body.etaMins,
        payoutPaise: payoutFor(body.distanceKm),
        tipPaise: body.tipPaise,
        codPaise: body.codPaise,
        handoverCode: code(),
        deliveryCode: body.deliveryCode,
      })
      .onConflict((oc) => oc.column("orderId").doNothing())
      .returningAll()
      .executeTakeFirst();
    // The order was already handed over: return what we have, never a second delivery
    return (
      inserted ??
      (await this.db
        .selectFrom("delivery.deliveries")
        .selectAll()
        .where("orderId", "=", body.orderId)
        .executeTakeFirstOrThrow())
    );
  }

  async cancelForOrder(orderId: string): Promise<void> {
    await this.db
      .updateTable("delivery.deliveries")
      .set({ status: "cancelled", offeredTo: null })
      .where("orderId", "=", orderId)
      .where("status", "in", ["unassigned", "offered", "assigned", "at_store"])
      .execute();
  }

  // -------------------------------------------------------------------------------------
  // The rider's view
  // -------------------------------------------------------------------------------------

  private async isOnline(riderId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("delivery.riderState")
      .select("online")
      .where("riderId", "=", riderId)
      .executeTakeFirst();
    return row?.online ?? false;
  }

  private async activeFor(riderId: string): Promise<Row | undefined> {
    return this.db
      .selectFrom("delivery.deliveries")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb.and([
            eb("riderId", "=", riderId),
            eb("status", "in", ["assigned", "at_store", "picked_up", "at_customer"]),
          ]),
          eb.and([eb("offeredTo", "=", riderId), eb("status", "=", "offered")]),
        ]),
      )
      .orderBy("createdAt")
      .executeTakeFirst();
  }

  /**
   * Gives an online, free rider the oldest waiting delivery in their warehouse. An offer that has
   * sat unanswered past its time goes back to the pool (and on to someone else) first. The claim
   * is one conditional UPDATE, so two riders asking at once cannot both get the same delivery.
   */
  private async dispatch(riderId: string, warehouseId: string): Promise<void> {
    const now = this.now();
    const expired = new Date(now.getTime() - OFFER_SECONDS * 1000);
    const retry = new Date(now.getTime() - RETRY_AFTER_SECONDS * 1000);

    // Offers nobody answered go back, remembering who ignored them
    await sql`
      update delivery.deliveries
      set status = 'unassigned',
          declined_by = array_append(declined_by, offered_to),
          offered_to = null
      where status = 'offered' and offered_at < ${expired} and offered_to is not null
    `.execute(this.db);

    await sql`
      update delivery.deliveries d
      set status = 'offered', offered_to = ${riderId}::uuid, offered_at = ${now}
      where d.id = (
        select id from delivery.deliveries
        where status = 'unassigned'
          and warehouse_id = ${warehouseId}
          and (not (${riderId}::uuid = any(declined_by)) or offered_at < ${retry})
        order by created_at
        limit 1
        for update skip locked
      )
    `.execute(this.db);
  }

  private async warehouseOfRider(riderId: string, hint: string | null): Promise<string | null> {
    if (hint) return hint;
    try {
      const { items } = await this.clients.identity.get<{
        items: { id: string; warehouseId: string | null }[];
      }>(`/internal/riders/batch?ids=${riderId}`);
      return items[0]?.warehouseId ?? null;
    } catch {
      return null;
    }
  }

  async state(riderId: string, warehouseHint: string | null): Promise<RiderState> {
    const online = await this.isOnline(riderId);
    if (online && !(await this.activeFor(riderId))) {
      const warehouseId = await this.warehouseOfRider(riderId, warehouseHint);
      if (warehouseId) await this.dispatch(riderId, warehouseId);
    }
    const active = await this.activeFor(riderId);
    const history = await this.db
      .selectFrom("delivery.deliveries")
      .selectAll()
      .where("riderId", "=", riderId)
      .where("status", "=", "delivered")
      .where("deliveredAt", ">=", startOfIndiaDay(this.now()))
      .orderBy("deliveredAt", "desc")
      .execute();
    return {
      online,
      active: active ? toRiderDelivery(active) : null,
      history: history.map(toRiderDelivery),
    };
  }

  async setOnline(riderId: string, warehouseHint: string | null, online: boolean) {
    if (!online) {
      const busy = await this.db
        .selectFrom("delivery.deliveries")
        .select("id")
        .where("riderId", "=", riderId)
        .where("status", "in", ["assigned", "at_store", "picked_up", "at_customer"])
        .executeTakeFirst();
      if (busy) {
        throw new DeliveryError(
          409,
          "INVALID_TRANSITION",
          "Finish your current delivery before going offline.",
        );
      }
      // An offer on screen goes back to the pool when the rider logs off
      await sql`
        update delivery.deliveries
        set status = 'unassigned', offered_to = null
        where status = 'offered' and offered_to = ${riderId}::uuid
      `.execute(this.db);
    }
    await this.db
      .insertInto("delivery.riderState")
      .values({ riderId, online })
      .onConflict((oc) => oc.column("riderId").doUpdateSet({ online }))
      .execute();
    return this.state(riderId, warehouseHint);
  }

  private async orderTransition(row: Row, to: string, riderId: string, extra: object = {}) {
    try {
      await this.clients.order.post(`/internal/orders/${row.orderId}/transition`, {
        to,
        actorId: riderId,
        actorRole: "rider",
        ...extra,
      });
    } catch (error) {
      if (error instanceof InternalCallError && error.status === 409) {
        throw new DeliveryError(409, "INVALID_TRANSITION", "This order was changed or cancelled.");
      }
      throw new HttpError(503, "We could not update the order. Please try again.");
    }
  }

  async act(
    riderId: string,
    warehouseHint: string | null,
    deliveryId: string,
    action: RiderAction,
  ) {
    const row = await this.db
      .selectFrom("delivery.deliveries")
      .selectAll()
      .where("id", "=", deliveryId)
      .executeTakeFirst();
    // Someone else's delivery looks the same as one that does not exist
    const mine = row && (row.riderId === riderId || row.offeredTo === riderId);
    if (!row || !mine) throw new HttpError(404, "Delivery not found.");

    const rule = NEXT[action.type];
    if (!rule.from.includes(row.status)) {
      throw new DeliveryError(
        409,
        "INVALID_TRANSITION",
        `Cannot ${action.type.replace("_", " ")} while the delivery is ${row.status.replace("_", " ")}.`,
      );
    }

    if (action.type === "decline") {
      await sql`
        update delivery.deliveries
        set status = 'unassigned', offered_to = null, offered_at = ${this.now()},
            declined_by = array_append(declined_by, ${riderId}::uuid)
        where id = ${deliveryId}::uuid and status = 'offered' and offered_to = ${riderId}::uuid
      `.execute(this.db);
      return this.state(riderId, warehouseHint);
    }

    if (action.type === "accept") {
      const fresh = new Date(this.now().getTime() - OFFER_SECONDS * 1000);
      const claimed = await this.db
        .updateTable("delivery.deliveries")
        .set({ status: "assigned", riderId, offeredTo: null })
        .where("id", "=", deliveryId)
        .where("status", "=", "offered")
        .where("offeredTo", "=", riderId)
        .where("offeredAt", ">=", fresh)
        .returning("id")
        .executeTakeFirst();
      if (!claimed)
        throw new DeliveryError(409, "OFFER_EXPIRED", "That offer is no longer available.");
      return this.state(riderId, warehouseHint);
    }

    if (action.type === "pick_up") {
      if (row.codeAttempts >= MAX_CODE_ATTEMPTS) {
        throw new DeliveryError(
          429,
          "CODE_LOCKED",
          "Too many wrong codes. Ask the warehouse manager.",
        );
      }
      const checked = new Set(action.checkedItemIds);
      if (!(row.items as Item[]).every((item) => checked.has(item.id))) {
        throw new DeliveryError(
          409,
          "ITEMS_NOT_CHECKED",
          "Check every item before leaving the store.",
        );
      }
      if (action.handoverCode !== row.handoverCode) {
        await this.bumpAttempts(deliveryId);
        throw new DeliveryError(
          409,
          "WRONG_CODE",
          "That code does not match the warehouse screen.",
        );
      }
      await this.orderTransition(row, "picked_up", riderId, { riderId });
      await this.orderTransition(row, "out_for_delivery", riderId);
      await this.db
        .updateTable("delivery.deliveries")
        .set({ status: "picked_up", codeAttempts: 0 })
        .where("id", "=", deliveryId)
        .where("status", "=", "at_store")
        .execute();
      return this.state(riderId, warehouseHint);
    }

    if (action.type === "deliver") {
      if (row.codeAttempts >= MAX_CODE_ATTEMPTS) {
        throw new DeliveryError(429, "CODE_LOCKED", "Too many wrong codes. Contact support.");
      }
      if (action.code !== row.deliveryCode) {
        await this.bumpAttempts(deliveryId);
        throw new DeliveryError(
          409,
          "WRONG_CODE",
          "That code does not match. Ask the customer again.",
        );
      }
      await this.orderTransition(row, "delivered", riderId);
      await this.db
        .updateTable("delivery.deliveries")
        .set({ status: "delivered", deliveredAt: this.now() })
        .where("id", "=", deliveryId)
        .where("status", "=", "at_customer")
        .execute();
      return this.state(riderId, warehouseHint);
    }

    // arrive_store, arrive_customer: plain step forward, only from the expected status
    const moved = await this.db
      .updateTable("delivery.deliveries")
      .set({ status: rule.to })
      .where("id", "=", deliveryId)
      .where("status", "=", row.status)
      .returning("id")
      .executeTakeFirst();
    if (!moved) throw new DeliveryError(409, "INVALID_TRANSITION", "That step was already done.");
    return this.state(riderId, warehouseHint);
  }

  private async bumpAttempts(deliveryId: string) {
    await sql`update delivery.deliveries set code_attempts = code_attempts + 1 where id = ${deliveryId}::uuid`.execute(
      this.db,
    );
  }

  // -------------------------------------------------------------------------------------
  // Warehouse and admin views
  // -------------------------------------------------------------------------------------

  async handovers(warehouseId: string): Promise<Handover[]> {
    const rows = await this.db
      .selectFrom("delivery.deliveries")
      .selectAll()
      .where("warehouseId", "=", warehouseId)
      .where("status", "in", ["unassigned", "offered", "assigned", "at_store"])
      .orderBy("createdAt")
      .execute();
    const riderIds = [
      ...new Set(rows.map((r) => r.riderId ?? r.offeredTo).filter((id): id is string => !!id)),
    ];
    const riders = new Map<string, { name: string; phone: string | null }>();
    if (riderIds.length > 0) {
      try {
        const { items } = await this.clients.identity.get<{
          items: { id: string; name: string; phone: string | null }[];
        }>(`/internal/riders/batch?ids=${riderIds.join(",")}`);
        for (const r of items) riders.set(r.id, { name: r.name, phone: r.phone });
      } catch {
        // show the handover without the rider's name
      }
    }
    return rows.map((r) => {
      const riderId = r.riderId ?? r.offeredTo;
      return {
        deliveryId: r.id,
        orderNumber: r.orderNumber,
        status: r.status as Handover["status"],
        itemCount: (r.items as Item[]).reduce((n, i) => n + i.quantity, 0),
        rider: riderId ? (riders.get(riderId) ?? null) : null,
        handoverCode: r.handoverCode,
      };
    });
  }

  async adminRiders(warehouseId?: string): Promise<AdminRider[]> {
    const path = warehouseId
      ? `/internal/riders?warehouseId=${encodeURIComponent(warehouseId)}`
      : "/internal/riders";
    let riders: {
      id: string;
      name: string;
      phone: string | null;
      vehicle: string;
      rating: number;
      warehouseId: string | null;
    }[];
    try {
      riders = (await this.clients.identity.get<{ items: typeof riders }>(path)).items;
    } catch {
      throw new HttpError(503, "Could not load riders right now.");
    }
    if (riders.length === 0) return [];
    const ids = riders.map((r) => r.id);
    const [states, busy, done] = await Promise.all([
      this.db
        .selectFrom("delivery.riderState")
        .select(["riderId", "online"])
        .where("riderId", "in", ids)
        .execute(),
      this.db
        .selectFrom("delivery.deliveries")
        .select("riderId")
        .where("riderId", "in", ids)
        .where("status", "in", ["assigned", "at_store", "picked_up", "at_customer"])
        .execute(),
      this.db
        .selectFrom("delivery.deliveries")
        .select(["riderId", (eb) => eb.fn.countAll<string>().as("n")])
        .where("riderId", "in", ids)
        .where("status", "=", "delivered")
        .where("deliveredAt", ">=", startOfIndiaDay(this.now()))
        .groupBy("riderId")
        .execute(),
    ]);
    const online = new Set(states.filter((s) => s.online).map((s) => s.riderId));
    const onJob = new Set(busy.map((b) => b.riderId));
    const counts = new Map(done.map((d) => [d.riderId, Number(d.n)]));
    return riders.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      vehicle: r.vehicle,
      rating: r.rating,
      status: onJob.has(r.id) ? "on_delivery" : online.has(r.id) ? "online" : "offline",
      deliveriesToday: counts.get(r.id) ?? 0,
      warehouseId: r.warehouseId ?? "",
    }));
  }
}

export { ACTIVE };
