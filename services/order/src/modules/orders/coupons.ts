import type {
  AdminCoupon,
  CouponOffer,
  CouponTerms,
  CouponType,
  CreateCouponBody,
  UpdateCouponBody,
} from "@qc/contracts";
import type { Kysely, Transaction } from "@qc/service-kit";
import { sql, type Selectable } from "kysely";
import type { DB, OrdersCoupons } from "../../db/types.generated";
import { badRequest, conflict, notFound } from "./errors";

export type CouponRow = Selectable<OrdersCoupons>;
type Db = Kysely<DB> | Transaction<DB>;

/** Orders that do not count as "a previous order" and do not hold a coupon use. */
const NOT_COUNTED = ["cancelled", "expired", "payment_failed"];

export const rupees = (paise: number) => {
  const r = paise / 100;
  return `₹${Number.isInteger(r) ? r : r.toFixed(2)}`;
};

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export const termsOf = (c: CouponRow): CouponTerms => ({
  code: c.code,
  type: c.type as CouponType,
  value: c.value,
  maxDiscountPaise: c.maxDiscountPaise,
  minOrderPaise: c.minOrderPaise,
});

export async function findCoupon(db: Db, code: string): Promise<CouponRow | undefined> {
  return db
    .selectFrom("orders.coupons")
    .selectAll()
    .where("code", "=", code.trim().toUpperCase())
    .executeTakeFirst();
}

/** Locks the coupon row for the rest of the transaction, so redemptions are counted one at a time. */
export async function lockCoupon(trx: Transaction<DB>, id: string): Promise<CouponRow> {
  const row = await trx
    .selectFrom("orders.coupons")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
  if (!row) throw conflict("This code is no longer available.");
  return row;
}

async function usage(db: Db, couponId: string, userId: string) {
  const row = await db
    .selectFrom("orders.couponRedemptions")
    .select((eb) => [
      eb.fn.countAll<string>().as("total"),
      eb.fn.count<string>(eb.case().when("userId", "=", userId).then(1).end()).as("mine"),
    ])
    .where("couponId", "=", couponId)
    .executeTakeFirstOrThrow();
  return { total: Number(row.total), mine: Number(row.mine) };
}

async function hasPreviousOrder(db: Db, userId: string): Promise<boolean> {
  const row = await db
    .selectFrom("orders.orders")
    .select("id")
    .where("userId", "=", userId)
    .where("status", "not in", NOT_COUNTED)
    .limit(1)
    .executeTakeFirst();
  return Boolean(row);
}

/**
 * Why this customer cannot use this coupon right now, or null when they can. The cart minimum is
 * checked by the price itself, since it depends on what is in the cart.
 */
export async function ineligibleReason(
  db: Db,
  coupon: CouponRow,
  userId: string,
  now: Date,
): Promise<string | null> {
  if (!coupon.active) return "This code is not active.";
  if (coupon.startsAt && coupon.startsAt > now)
    return `This offer starts on ${day(coupon.startsAt)}.`;
  if (coupon.endsAt && coupon.endsAt <= now) return "This code has expired.";
  const used = await usage(db, coupon.id, userId);
  if (coupon.usageLimitTotal !== null && used.total >= coupon.usageLimitTotal) {
    return "This offer has been fully used.";
  }
  if (coupon.usageLimitPerUser !== null && used.mine >= coupon.usageLimitPerUser) {
    return coupon.usageLimitPerUser === 1
      ? "You have already used this code."
      : `You can use this code ${coupon.usageLimitPerUser} times, and you have.`;
  }
  if (coupon.firstOrderOnly && (await hasPreviousOrder(db, userId))) {
    return "This code is only for your first order.";
  }
  return null;
}

export function toOffer(coupon: CouponRow, reason: string | null): CouponOffer {
  return {
    code: coupon.code,
    title: coupon.title,
    description: coupon.description,
    type: coupon.type as CouponType,
    value: coupon.value,
    maxDiscountPaise: coupon.maxDiscountPaise,
    minOrderPaise: coupon.minOrderPaise,
    endsAt: coupon.endsAt ? coupon.endsAt.toISOString() : null,
    eligible: reason === null,
    reason,
  };
}

/** Coupons a customer can see now: active and inside their window, with whether they can use each. */
export async function offersFor(db: Kysely<DB>, userId: string, now: Date): Promise<CouponOffer[]> {
  const rows = await db
    .selectFrom("orders.coupons")
    .selectAll()
    .where("active", "=", true)
    .where((eb) => eb.or([eb("startsAt", "is", null), eb("startsAt", "<=", now)]))
    .where((eb) => eb.or([eb("endsAt", "is", null), eb("endsAt", ">", now)]))
    .orderBy("createdAt", "desc")
    .execute();
  const offers = await Promise.all(
    rows.map(async (row) => toOffer(row, await ineligibleReason(db, row, userId, now))),
  );
  // Ones you can use first
  return offers.sort((a, b) => Number(b.eligible) - Number(a.eligible));
}

// --- Admin ---------------------------------------------------------------------------------------

function stateOf(c: CouponRow, redemptions: number, now: Date): AdminCoupon["state"] {
  if (!c.active) return "inactive";
  if (c.endsAt && c.endsAt <= now) return "ended";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  if (c.usageLimitTotal !== null && redemptions >= c.usageLimitTotal) return "used_up";
  return "live";
}

export async function adminCoupons(db: Kysely<DB>, now: Date, id?: string): Promise<AdminCoupon[]> {
  let query = db
    .selectFrom("orders.coupons as c")
    .leftJoin("orders.couponRedemptions as r", "r.couponId", "c.id")
    .selectAll("c")
    .select((eb) => [
      eb.fn.count<string>("r.id").as("redemptions"),
      sql<string>`coalesce(sum(r.discount_paise), 0)`.as("discountGiven"),
    ])
    .groupBy("c.id")
    .orderBy("c.createdAt", "desc");
  if (id) query = query.where("c.id", "=", id);
  const rows = await query.execute();
  return rows.map((r) => {
    const redemptions = Number(r.redemptions);
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      type: r.type as CouponType,
      value: r.value,
      maxDiscountPaise: r.maxDiscountPaise,
      minOrderPaise: r.minOrderPaise,
      startsAt: r.startsAt ? r.startsAt.toISOString() : null,
      endsAt: r.endsAt ? r.endsAt.toISOString() : null,
      usageLimitTotal: r.usageLimitTotal,
      usageLimitPerUser: r.usageLimitPerUser,
      firstOrderOnly: r.firstOrderOnly,
      active: r.active,
      state: stateOf(r, redemptions, now),
      redemptions,
      discountGivenPaise: Number(r.discountGiven),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

/** A database check failed: say which rule, in words an admin understands. */
function friendly(error: unknown): never {
  const code = (error as { code?: string }).code;
  const constraint = (error as { constraint?: string }).constraint ?? "";
  if (code === "23505") throw conflict("A coupon with this code already exists.");
  if (code === "23514") {
    if (constraint.includes("percent")) throw badRequest("A percent coupon is 1 to 100.");
    if (constraint.includes("flat")) throw badRequest("A flat coupon needs an amount.");
    if (constraint.includes("window")) throw badRequest("The end must be after the start.");
    throw badRequest("Some values are not allowed.");
  }
  throw error;
}

export async function createCoupon(db: Kysely<DB>, body: CreateCouponBody & { code: string }) {
  try {
    const row = await db
      .insertInto("orders.coupons")
      .values({
        code: body.code,
        title: body.title,
        description: body.description ?? "",
        type: body.type,
        value: body.type === "free_delivery" ? 0 : body.value,
        maxDiscountPaise: body.type === "percent" ? (body.maxDiscountPaise ?? null) : null,
        minOrderPaise: body.minOrderPaise ?? 0,
        startsAt: body.startsAt ?? null,
        endsAt: body.endsAt ?? null,
        usageLimitTotal: body.usageLimitTotal ?? null,
        usageLimitPerUser: body.usageLimitPerUser === undefined ? 1 : body.usageLimitPerUser,
        firstOrderOnly: body.firstOrderOnly ?? false,
        active: body.active ?? true,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  } catch (error) {
    return friendly(error);
  }
}

export async function updateCoupon(db: Kysely<DB>, id: string, body: UpdateCouponBody) {
  const existing = await db
    .selectFrom("orders.coupons")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!existing) throw notFound("Coupon not found.");
  const type = body.type ?? (existing.type as CouponType);
  const patch: Record<string, unknown> = { ...body };
  if (type === "free_delivery") patch.value = 0;
  if (type !== "percent") patch.maxDiscountPaise = null;
  try {
    await db.updateTable("orders.coupons").set(patch).where("id", "=", id).execute();
  } catch (error) {
    friendly(error);
  }
}
