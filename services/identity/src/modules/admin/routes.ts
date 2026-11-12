import { phoneSchema, roleSchema } from "@qc/contracts";
import { requireRole, type ServiceApp } from "@qc/service-kit";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { DB } from "../../db/types.generated";
import { conflict } from "../auth/errors";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../auth/password";

const createRiderBody = z.object({
  name: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  vehicle: z.string().trim().max(80).default(""),
  warehouseId: z.string().min(1),
});

const createStaffBody = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  role: z.enum(["warehouse_staff", "warehouse_manager"]),
  warehouseId: z.string().min(1),
});

const idParams = z.object({ id: z.uuid() });
const createdResponse = z.object({ id: z.uuid(), role: roleSchema });
const okResponse = z.object({ ok: z.literal(true) });

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === "23505";

/** Staff and riders are created by an admin. There is no self sign up for those roles. */
export function registerAdminRoutes(app: ServiceApp, db: Kysely<DB>): void {
  app.post(
    "/v1/identity/admin/riders",
    {
      schema: {
        tags: ["identity-admin"],
        summary: "Register a rider",
        body: createRiderBody,
        response: { 201: createdResponse },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      const { name, phone, vehicle, warehouseId } = request.body;
      try {
        const user = await db.transaction().execute(async (trx) => {
          const created = await trx
            .insertInto("identity.users")
            .values({ role: "rider", name, phone })
            .returning(["id", "role"])
            .executeTakeFirstOrThrow();
          await trx
            .insertInto("identity.riderProfiles")
            .values({ userId: created.id, vehicle, warehouseId })
            .execute();
          return created;
        });
        return reply.status(201).send({ id: user.id, role: "rider" as const });
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict("That phone number is already registered.");
        throw error;
      }
    },
  );

  app.post(
    "/v1/identity/admin/staff",
    {
      schema: {
        tags: ["identity-admin"],
        summary: "Create a warehouse staff or manager account",
        body: createStaffBody,
        response: { 201: createdResponse },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      const { name, email, password, role, warehouseId } = request.body;
      try {
        const user = await db
          .insertInto("identity.users")
          .values({ role, name, email, passwordHash: await hashPassword(password), warehouseId })
          .returning(["id", "role"])
          .executeTakeFirstOrThrow();
        return reply.status(201).send({ id: user.id, role });
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict("That email is already registered.");
        throw error;
      }
    },
  );

  const setStatus = (path: string, status: "active" | "blocked", summary: string) =>
    app.post(
      path,
      {
        schema: {
          tags: ["identity-admin"],
          summary,
          params: idParams,
          response: { 200: okResponse },
        },
      },
      async (request) => {
        requireRole(request, "admin");
        const updated = await db
          .updateTable("identity.users")
          .set({ status })
          .where("id", "=", request.params.id)
          .returning("id")
          .executeTakeFirst();
        if (!updated) throw app.httpErrors.notFound("User not found.");
        if (status === "blocked") {
          // Existing sessions end at once; the short lived access token runs out on its own
          await db
            .updateTable("identity.refreshTokens")
            .set({ revokedAt: new Date() })
            .where("userId", "=", request.params.id)
            .where("revokedAt", "is", null)
            .execute();
        }
        return { ok: true as const };
      },
    );

  setStatus("/v1/identity/admin/users/:id/block", "blocked", "Block a user and end their sessions");
  setStatus("/v1/identity/admin/users/:id/unblock", "active", "Unblock a user");
}
