import { z } from "zod";
import type { ServiceApp } from "@qc/service-kit";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.generated";

const batchQuery = z.object({
  ids: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.uuid()).min(1).max(200)),
});

const personSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  vehicle: z.string(),
  rating: z.number(),
  warehouseId: z.string().nullable(),
  status: z.string(),
});

/** Service to service reads. Never routed by the gateway. */
export function registerInternalRoutes(app: ServiceApp, db: Kysely<DB>): void {
  app.get(
    "/internal/riders/batch",
    {
      schema: {
        tags: ["internal"],
        summary: "Rider details for a list of ids",
        querystring: batchQuery,
        response: { 200: z.object({ items: z.array(personSchema) }) },
      },
    },
    async (request) => {
      const rows = await db
        .selectFrom("identity.users as u")
        .innerJoin("identity.riderProfiles as r", "r.userId", "u.id")
        .select(["u.id", "u.name", "u.phone", "u.status", "r.vehicle", "r.rating", "r.warehouseId"])
        .where("u.id", "in", request.query.ids)
        .execute();
      return {
        items: rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          vehicle: r.vehicle,
          rating: Number(r.rating),
          warehouseId: r.warehouseId,
          status: r.status,
        })),
      };
    },
  );

  app.get(
    "/internal/riders",
    {
      schema: {
        tags: ["internal"],
        summary: "Active riders of one warehouse",
        querystring: z.object({ warehouseId: z.string().min(1) }),
        response: { 200: z.object({ items: z.array(personSchema) }) },
      },
    },
    async (request) => {
      const rows = await db
        .selectFrom("identity.users as u")
        .innerJoin("identity.riderProfiles as r", "r.userId", "u.id")
        .select(["u.id", "u.name", "u.phone", "u.status", "r.vehicle", "r.rating", "r.warehouseId"])
        .where("r.warehouseId", "=", request.query.warehouseId)
        .where("u.status", "=", "active")
        .orderBy("u.name")
        .execute();
      return {
        items: rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          vehicle: r.vehicle,
          rating: Number(r.rating),
          warehouseId: r.warehouseId,
          status: r.status,
        })),
      };
    },
  );

  app.get(
    "/internal/users/:id",
    {
      schema: {
        tags: ["internal"],
        summary: "A user's name and phone, for showing on an order",
        params: z.object({ id: z.uuid() }),
        response: {
          200: z.object({ id: z.uuid(), name: z.string(), phone: z.string().nullable() }),
        },
      },
    },
    async (request) => {
      const user = await db
        .selectFrom("identity.users")
        .select(["id", "name", "phone"])
        .where("id", "=", request.params.id)
        .executeTakeFirst();
      if (!user) throw app.httpErrors.notFound("User not found.");
      return user;
    },
  );
}
