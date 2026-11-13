import {
  addressListResponseSchema,
  addressParamsSchema,
  createAddressBodySchema,
  customerAddressSchema,
  MAX_ADDRESSES,
  updateAddressBodySchema,
  type CustomerAddress,
} from "@qc/contracts";
import { requireRole, type ServiceApp } from "@qc/service-kit";
import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, IdentityAddresses } from "../../db/types.generated";
import { HttpError } from "../auth/errors";

type Row = Selectable<IdentityAddresses>;

const toAddress = (r: Row): CustomerAddress => ({
  id: r.id,
  kind: r.kind as CustomerAddress["kind"],
  label: r.label,
  line1: r.line1,
  line2: r.line2,
  landmark: r.landmark,
  instructions: r.instructions,
  lat: r.lat,
  lng: r.lng,
  pincode: r.pincode,
  areaId: r.areaId,
  isDefault: r.isDefault,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const notFound = () => new HttpError(404, "Address not found.");

/**
 * A customer's own saved addresses. Every query is scoped to the signed in customer, so someone
 * else's address looks exactly like one that does not exist.
 */
export function registerAddressRoutes(app: ServiceApp, db: Kysely<DB>): void {
  const mine = (dbOrTrx: Kysely<DB> | Transaction<DB>, userId: string) =>
    dbOrTrx
      .selectFrom("identity.addresses")
      .selectAll()
      .where("userId", "=", userId)
      .where("deletedAt", "is", null);

  const list = async (userId: string) =>
    (await mine(db, userId).orderBy("isDefault", "desc").orderBy("createdAt").execute()).map(
      toAddress,
    );

  /** Makes one address the default, clearing the old one in the same transaction. */
  const setDefault = async (trx: Transaction<DB>, userId: string, id: string) => {
    await trx
      .updateTable("identity.addresses")
      .set({ isDefault: false })
      .where("userId", "=", userId)
      .where("isDefault", "=", true)
      .where("deletedAt", "is", null)
      .execute();
    await trx
      .updateTable("identity.addresses")
      .set({ isDefault: true })
      .where("id", "=", id)
      .where("userId", "=", userId)
      .execute();
  };

  app.get(
    "/v1/identity/me/addresses",
    {
      schema: {
        tags: ["addresses"],
        summary: "My saved addresses, default first",
        response: { 200: addressListResponseSchema },
      },
    },
    async (request) => ({ items: await list(requireRole(request, "customer").userId) }),
  );

  app.post(
    "/v1/identity/me/addresses",
    {
      schema: {
        tags: ["addresses"],
        summary: "Save an address",
        body: createAddressBodySchema,
        response: { 201: customerAddressSchema },
      },
    },
    async (request, reply) => {
      const { userId } = requireRole(request, "customer");
      const body = request.body;
      const created = await db.transaction().execute(async (trx) => {
        // Lock the customer's row so two saves at once cannot both slip under the limit
        await trx
          .selectFrom("identity.users")
          .select("id")
          .where("id", "=", userId)
          .forUpdate()
          .executeTakeFirst();
        const existing = await mine(trx, userId).select(["isDefault"]).execute();
        if (existing.length >= MAX_ADDRESSES) {
          throw new HttpError(409, `You can save up to ${MAX_ADDRESSES} addresses.`);
        }
        const row = await trx
          .insertInto("identity.addresses")
          .values({
            userId,
            kind: body.kind,
            label: body.kind === "other" ? body.label : "",
            line1: body.line1,
            line2: body.line2,
            landmark: body.landmark,
            instructions: body.instructions,
            lat: body.lat,
            lng: body.lng,
            pincode: body.pincode,
            areaId: body.areaId,
            isDefault: false,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        // The first address, or one saved as default, becomes the default
        if (body.isDefault || existing.length === 0) await setDefault(trx, userId, row.id);
        return mine(trx, userId).where("id", "=", row.id).executeTakeFirstOrThrow();
      });
      return reply.status(201).send(toAddress(created));
    },
  );

  app.patch(
    "/v1/identity/me/addresses/:id",
    {
      schema: {
        tags: ["addresses"],
        summary: "Change a saved address",
        params: addressParamsSchema,
        body: updateAddressBodySchema,
        response: { 200: customerAddressSchema },
      },
    },
    async (request) => {
      const { userId } = requireRole(request, "customer");
      const current = await mine(db, userId).where("id", "=", request.params.id).executeTakeFirst();
      if (!current) throw notFound();
      const body = request.body;
      const kind = body.kind ?? current.kind;
      const label = kind === "other" ? (body.label ?? current.label) : "";
      if (kind === "other" && label.length < 2) {
        throw new HttpError(400, "Give this address a name, like Parents.");
      }
      const updated = await db
        .updateTable("identity.addresses")
        .set({
          kind,
          label,
          ...(body.line1 !== undefined ? { line1: body.line1 } : {}),
          ...(body.line2 !== undefined ? { line2: body.line2 } : {}),
          ...(body.landmark !== undefined ? { landmark: body.landmark } : {}),
          ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
          ...(body.lat !== undefined ? { lat: body.lat, lng: body.lng } : {}),
          ...(body.pincode !== undefined ? { pincode: body.pincode } : {}),
          ...(body.areaId !== undefined ? { areaId: body.areaId } : {}),
        })
        .where("id", "=", request.params.id)
        .where("userId", "=", userId)
        .where("deletedAt", "is", null)
        .returningAll()
        .executeTakeFirst();
      if (!updated) throw notFound();
      return toAddress(updated);
    },
  );

  app.delete(
    "/v1/identity/me/addresses/:id",
    {
      schema: {
        tags: ["addresses"],
        summary: "Delete a saved address (the next one becomes the default)",
        params: addressParamsSchema,
        response: { 200: addressListResponseSchema },
      },
    },
    async (request) => {
      const { userId } = requireRole(request, "customer");
      await db.transaction().execute(async (trx) => {
        const removed = await trx
          .updateTable("identity.addresses")
          .set({ deletedAt: new Date(), isDefault: false })
          .where("id", "=", request.params.id)
          .where("userId", "=", userId)
          .where("deletedAt", "is", null)
          .returning("id")
          .executeTakeFirst();
        if (!removed) throw notFound();
        const hasDefault = await mine(trx, userId)
          .where("isDefault", "=", true)
          .select("id")
          .executeTakeFirst();
        if (!hasDefault) {
          const next = await mine(trx, userId).orderBy("createdAt").executeTakeFirst();
          if (next) await setDefault(trx, userId, next.id);
        }
      });
      return { items: await list(userId) };
    },
  );

  app.post(
    "/v1/identity/me/addresses/:id/default",
    {
      schema: {
        tags: ["addresses"],
        summary: "Make an address the default",
        params: addressParamsSchema,
        response: { 200: addressListResponseSchema },
      },
    },
    async (request) => {
      const { userId } = requireRole(request, "customer");
      await db.transaction().execute(async (trx) => {
        const found = await mine(trx, userId)
          .where("id", "=", request.params.id)
          .executeTakeFirst();
        if (!found) throw notFound();
        await setDefault(trx, userId, found.id);
      });
      return { items: await list(userId) };
    },
  );
}
