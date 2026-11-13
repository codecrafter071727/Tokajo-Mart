import type { Identity, InternalClient, Kysely } from "@qc/service-kit";
import type { DB } from "../../db/types.generated";
import { HttpError } from "../auth/errors";

export type DeletionClients = {
  order: InternalClient;
  payment: InternalClient;
  notification: InternalClient;
};

export const DELETED_NAME = "Deleted user";

const unavailable = () =>
  new HttpError(503, "We could not delete your account right now. Please try again in a minute.");

/**
 * Deletes a customer's account. Order of work matters: everything another service holds is
 * cleared first (each call is safe to repeat), and only then is the account itself anonymised
 * in one transaction. If any step fails nothing here changes and the customer can simply retry.
 */
export async function deleteCustomerAccount(
  db: Kysely<DB>,
  clients: DeletionClients,
  identity: Identity,
  reason: string | undefined,
  now: Date,
): Promise<{ deletedAt: Date }> {
  if (identity.role !== "customer") {
    throw new HttpError(
      403,
      identity.role === "rider"
        ? "Ask your warehouse manager to close your rider account."
        : "Staff accounts are closed by an admin.",
    );
  }

  const user = await db
    .selectFrom("identity.users")
    .select(["id", "status", "deletedAt"])
    .where("id", "=", identity.userId)
    .executeTakeFirst();
  if (!user) throw new HttpError(404, "Account not found.");
  // Pressing delete twice, or retrying after a lost reply, is fine
  if (user.status === "deleted" && user.deletedAt) return { deletedAt: user.deletedAt };

  // An order still on its way needs the customer's name and phone for the rider and support
  let active: { count: number; numbers: string[] };
  try {
    active = await clients.order.get(`/internal/customers/${identity.userId}/active-orders`);
  } catch {
    throw unavailable();
  }
  if (active.count > 0) {
    const which = active.numbers.slice(0, 3).join(", ");
    throw new HttpError(
      409,
      `You have an order in progress (${which}). You can delete your account once it is delivered or cancelled.`,
    );
  }

  try {
    await clients.notification.post(`/internal/users/${identity.userId}/purge`);
    await clients.order.post(`/internal/customers/${identity.userId}/scrub`);
    await clients.payment.post(`/internal/payments/customers/${identity.userId}/scrub`);
  } catch {
    throw unavailable();
  }

  await db.transaction().execute(async (trx) => {
    const old = await trx
      .selectFrom("identity.users")
      .select("phone")
      .where("id", "=", identity.userId)
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("identity.refreshTokens")
      .set({ revokedAt: now })
      .where("userId", "=", identity.userId)
      .where("revokedAt", "is", null)
      .execute();
    await trx.deleteFrom("identity.addresses").where("userId", "=", identity.userId).execute();
    if (old.phone) {
      await trx.deleteFrom("identity.otpChallenges").where("phone", "=", old.phone).execute();
    }
    await trx
      .updateTable("identity.users")
      .set({
        name: DELETED_NAME,
        phone: null,
        email: null,
        passwordHash: null,
        status: "deleted",
        deletedAt: now,
        deletionReason: reason?.trim() || null,
      })
      .where("id", "=", identity.userId)
      .execute();
  });
  return { deletedAt: now };
}
