import {
  NOTIFICATION_TYPES,
  type AdminNotification,
  type InternalNotifyBody,
  type Notification,
  type NotificationData,
  type StockRestockedBody,
  type StockSubscription,
} from "@qc/contracts";
import type { Identity, Kysely } from "@qc/service-kit";
import { sql, type Selectable } from "kysely";
import type { DB, NotificationsNotifications } from "../../db/types.generated";
import { NotificationError } from "./errors";

type Row = Selectable<NotificationsNotifications>;

const toNotification = (row: Row): Notification => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  data: (row.data ?? {}) as NotificationData,
  readAt: row.readAt ? row.readAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
});

/** The cursor is the last row's time and id, so paging is stable while new rows arrive. */
export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}
export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(at ?? "");
  if (!id || Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return { createdAt, id };
}

export class NotificationService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ---------------------------------------------------------------------------------------
  // The customer's inbox
  // ---------------------------------------------------------------------------------------

  async list(userId: string, limit: number, cursor?: string) {
    let query = this.db
      .selectFrom("notifications.notifications")
      .selectAll()
      .where("userId", "=", userId);
    if (cursor) {
      const after = decodeCursor(cursor);
      if (!after) throw new NotificationError(400, "That page link is not valid.");
      query = query.where((eb) =>
        eb.or([
          eb("createdAt", "<", after.createdAt),
          eb.and([eb("createdAt", "=", after.createdAt), eb("id", "<", after.id)]),
        ]),
      );
    }
    const rows = await query
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(limit + 1)
      .execute();
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toNotification),
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    const row = await this.db
      .selectFrom("notifications.notifications")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("userId", "=", userId)
      .where("readAt", "is", null)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const row = await this.db
      .updateTable("notifications.notifications")
      .set((eb) => ({ readAt: eb.fn.coalesce("readAt", sql<Date>`${this.now()}`) }))
      .where("id", "=", id)
      .where("userId", "=", userId)
      .returningAll()
      .executeTakeFirst();
    // Someone else's notification looks the same as one that does not exist
    if (!row) throw new NotificationError(404, "Notification not found.");
    return toNotification(row);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.db
      .updateTable("notifications.notifications")
      .set({ readAt: this.now() })
      .where("userId", "=", userId)
      .where("readAt", "is", null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  // ---------------------------------------------------------------------------------------
  // Sending (internal)
  // ---------------------------------------------------------------------------------------

  /** Creates one notification. With a dedupe key, a repeat returns the first one. */
  async notify(input: InternalNotifyBody & { body: string; data: NotificationData }) {
    const inserted = await this.db
      .insertInto("notifications.notifications")
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: JSON.stringify(input.data),
        dedupeKey: input.dedupeKey ?? null,
        createdAt: this.now(),
      })
      .onConflict((oc) => oc.column("dedupeKey").doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return { notification: toNotification(inserted), created: true };
    const existing = await this.db
      .selectFrom("notifications.notifications")
      .selectAll()
      .where("dedupeKey", "=", input.dedupeKey as string)
      .executeTakeFirstOrThrow();
    return { notification: toNotification(existing), created: false };
  }

  /**
   * A product is back at a warehouse: tell everyone waiting for it, once, and close their
   * subscriptions. Closing and notifying happen in one transaction so nobody is told twice.
   */
  async stockRestocked(input: StockRestockedBody): Promise<{ notified: number }> {
    const now = this.now();
    return this.db.transaction().execute(async (trx) => {
      const closed = await trx
        .updateTable("notifications.subscriptions")
        .set({ notifiedAt: now })
        .where("warehouseId", "=", input.warehouseId)
        .where("productId", "=", input.productId)
        .where("notifiedAt", "is", null)
        .where("cancelledAt", "is", null)
        .returning(["id", "userId"])
        .execute();
      if (closed.length === 0) return { notified: 0 };
      const name = input.productName?.trim();
      await trx
        .insertInto("notifications.notifications")
        .values(
          closed.map((s) => ({
            userId: s.userId,
            type: NOTIFICATION_TYPES.backInStock,
            title: name ? `${name} is back in stock` : "An item you wanted is back",
            body: "Grab it before it sells out again.",
            data: JSON.stringify({ productId: input.productId, warehouseId: input.warehouseId }),
            dedupeKey: `restock:${s.id}`,
            createdAt: now,
          })),
        )
        .onConflict((oc) => oc.column("dedupeKey").doNothing())
        .execute();
      return { notified: closed.length };
    });
  }

  // ---------------------------------------------------------------------------------------
  // Notify me
  // ---------------------------------------------------------------------------------------

  async subscriptions(userId: string): Promise<StockSubscription[]> {
    const rows = await this.db
      .selectFrom("notifications.subscriptions")
      .select(["id", "productId", "warehouseId", "createdAt"])
      .where("userId", "=", userId)
      .where("notifiedAt", "is", null)
      .where("cancelledAt", "is", null)
      .orderBy("createdAt", "desc")
      .execute();
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  /** Idempotent: subscribing twice keeps the one open subscription. */
  async subscribe(userId: string, productId: string, warehouseId: string) {
    const open = await this.subscriptions(userId);
    if (open.length >= 100) {
      throw new NotificationError(409, "You are already waiting for 100 items.");
    }
    await this.db
      .insertInto("notifications.subscriptions")
      .values({ userId, productId, warehouseId, createdAt: this.now() })
      .onConflict((oc) =>
        oc
          .columns(["userId", "productId", "warehouseId"])
          .where("notifiedAt", "is", null)
          .where("cancelledAt", "is", null)
          .doNothing(),
      )
      .execute();
    const row = await this.db
      .selectFrom("notifications.subscriptions")
      .select(["id", "productId", "warehouseId", "createdAt"])
      .where("userId", "=", userId)
      .where("productId", "=", productId)
      .where("warehouseId", "=", warehouseId)
      .where("notifiedAt", "is", null)
      .where("cancelledAt", "is", null)
      .executeTakeFirstOrThrow();
    return { ...row, createdAt: row.createdAt.toISOString() };
  }

  async unsubscribe(userId: string, productId: string, warehouseId: string): Promise<void> {
    await this.db
      .updateTable("notifications.subscriptions")
      .set({ cancelledAt: this.now() })
      .where("userId", "=", userId)
      .where("productId", "=", productId)
      .where("warehouseId", "=", warehouseId)
      .where("notifiedAt", "is", null)
      .where("cancelledAt", "is", null)
      .execute();
  }

  // ---------------------------------------------------------------------------------------
  // Devices (kept for push later)
  // ---------------------------------------------------------------------------------------

  async registerDevice(userId: string, platform: string, token: string): Promise<void> {
    await this.db
      .insertInto("notifications.deviceTokens")
      .values({ userId, platform, token, lastSeenAt: this.now() })
      // A phone that changed hands belongs to whoever signed in last
      .onConflict((oc) =>
        oc.column("token").doUpdateSet({ userId, platform, lastSeenAt: this.now() }),
      )
      .execute();
  }

  // ---------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------

  async adminList(
    identity: Identity,
    filter: { type?: string; userId?: string; limit: number },
  ): Promise<{
    items: AdminNotification[];
    counts: { last24h: number; unread: number; openSubscriptions: number };
  }> {
    if (identity.role !== "admin")
      throw new NotificationError(403, "You are not allowed to do this.");
    let query = this.db.selectFrom("notifications.notifications").selectAll();
    if (filter.type) query = query.where("type", "=", filter.type);
    if (filter.userId) query = query.where("userId", "=", filter.userId);
    const rows = await query
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(filter.limit)
      .execute();
    const since = new Date(this.now().getTime() - 86_400_000);
    const [recent, unread, open] = await Promise.all([
      this.db
        .selectFrom("notifications.notifications")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("createdAt", ">=", since)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("notifications.notifications")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("readAt", "is", null)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("notifications.subscriptions")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("notifiedAt", "is", null)
        .where("cancelledAt", "is", null)
        .executeTakeFirstOrThrow(),
    ]);
    return {
      items: rows.map((r) => ({ ...toNotification(r), userId: r.userId })),
      counts: {
        last24h: Number(recent.n),
        unread: Number(unread.n),
        openSubscriptions: Number(open.n),
      },
    };
  }
}
