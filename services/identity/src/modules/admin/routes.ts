import {
  adminUserSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
  phoneSchema,
  resetPasswordBodySchema,
  roleSchema,
  updateRiderBodySchema,
  updateStaffBodySchema,
  type AdminUser,
} from "@qc/contracts";
import { requireRole, type ServiceApp } from "@qc/service-kit";
import { sql, type Kysely } from "kysely";
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

const STAFF_ROLES = ["warehouse_staff", "warehouse_manager"];

type Cursor = { at: string; id: string };
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decodeCursor(value: string): Cursor | null {
  try {
    const c = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    return typeof c.at === "string" &&
      !Number.isNaN(Date.parse(c.at)) &&
      typeof c.id === "string" &&
      /^[0-9a-f-]{36}$/.test(c.id)
      ? c
      : null;
  } catch {
    return null;
  }
}

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

  app.get(
    "/v1/identity/admin/users",
    {
      schema: {
        tags: ["identity-admin"],
        summary: "List and search users, newest first",
        querystring: adminUsersQuerySchema,
        response: { 200: adminUsersResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const { role, status, q, limit, cursor } = request.query;
      let query = db
        .selectFrom("identity.users as u")
        .leftJoin("identity.riderProfiles as r", "r.userId", "u.id")
        .select([
          "u.id",
          "u.role",
          "u.name",
          "u.phone",
          "u.email",
          "u.status",
          "u.createdAt",
          // Kept as text: a JS Date loses the microseconds, and the cursor must not skip rows
          sql<string>`u.created_at::text`.as("createdAtRaw"),
          "r.vehicle",
          "r.rating",
          (eb) => eb.fn.coalesce("r.warehouseId", "u.warehouseId").as("warehouseId"),
        ]);
      if (role) query = query.where("u.role", "=", role);
      if (status) query = query.where("u.status", "=", status);
      if (q) {
        const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        query = query.where((eb) =>
          eb.or([
            eb("u.name", "ilike", like),
            eb("u.phone", "ilike", like),
            eb("u.email", "ilike", like),
          ]),
        );
      }
      if (cursor) {
        const c = decodeCursor(cursor);
        if (!c) throw app.httpErrors.badRequest("Invalid cursor.");
        query = query.where(
          sql<boolean>`(u.created_at, u.id) < (${c.at}::timestamptz, ${c.id}::uuid)`,
        );
      }
      const rows = await query
        .orderBy("u.createdAt", "desc")
        .orderBy("u.id", "desc")
        .limit(limit + 1)
        .execute();
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: page.map((u): AdminUser => ({
          id: u.id,
          role: u.role as AdminUser["role"],
          name: u.name,
          phone: u.phone,
          email: u.email,
          status: u.status as AdminUser["status"],
          warehouseId: u.warehouseId,
          createdAt: u.createdAt.toISOString(),
          vehicle: u.vehicle,
          rating: u.rating === null ? null : Number(u.rating),
        })),
        nextCursor:
          rows.length > limit && last ? encodeCursor({ at: last.createdAtRaw, id: last.id }) : null,
      };
    },
  );

  app.get(
    "/v1/identity/admin/users/:id",
    {
      schema: {
        tags: ["identity-admin"],
        summary: "One user, for the admin detail pages",
        params: idParams,
        response: { 200: adminUserSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const u = await db
        .selectFrom("identity.users as u")
        .leftJoin("identity.riderProfiles as r", "r.userId", "u.id")
        .select([
          "u.id",
          "u.role",
          "u.name",
          "u.phone",
          "u.email",
          "u.status",
          "u.createdAt",
          "r.vehicle",
          "r.rating",
          (eb) => eb.fn.coalesce("r.warehouseId", "u.warehouseId").as("warehouseId"),
        ])
        .where("u.id", "=", request.params.id)
        .executeTakeFirst();
      if (!u) throw app.httpErrors.notFound("User not found.");
      return {
        id: u.id,
        role: u.role as AdminUser["role"],
        name: u.name,
        phone: u.phone,
        email: u.email,
        status: u.status as AdminUser["status"],
        warehouseId: u.warehouseId,
        createdAt: u.createdAt.toISOString(),
        vehicle: u.vehicle,
        rating: u.rating === null ? null : Number(u.rating),
      };
    },
  );

  app.patch(
    "/v1/identity/admin/riders/:id",
    {
      schema: {
        tags: ["identity-admin"],
        summary: "Edit a rider's name, vehicle or warehouse",
        params: idParams,
        body: updateRiderBodySchema,
        response: { 200: okResponse },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const { name, vehicle, warehouseId } = request.body;
      const ok = await db.transaction().execute(async (trx) => {
        const rider = await trx
          .selectFrom("identity.users")
          .select("id")
          .where("id", "=", request.params.id)
          .where("role", "=", "rider")
          .executeTakeFirst();
        if (!rider) return false;
        if (name) {
          await trx
            .updateTable("identity.users")
            .set({ name })
            .where("id", "=", rider.id)
            .execute();
        }
        if (vehicle !== undefined || warehouseId) {
          await trx
            .updateTable("identity.riderProfiles")
            .set({
              ...(vehicle !== undefined ? { vehicle } : {}),
              ...(warehouseId ? { warehouseId } : {}),
            })
            .where("userId", "=", rider.id)
            .execute();
        }
        return true;
      });
      if (!ok) throw app.httpErrors.notFound("Rider not found.");
      return { ok: true as const };
    },
  );

  app.patch(
    "/v1/identity/admin/staff/:id",
    {
      schema: {
        tags: ["identity-admin"],
        summary: "Edit a staff member's name, role or warehouse",
        params: idParams,
        body: updateStaffBodySchema,
        response: { 200: okResponse },
      },
    },
    async (request) => {
      const admin = requireRole(request, "admin");
      if (request.params.id === admin.userId) {
        throw conflict("You cannot change your own account here.");
      }
      const updated = await db
        .updateTable("identity.users")
        .set(request.body)
        .where("id", "=", request.params.id)
        .where("role", "in", STAFF_ROLES)
        .returning("id")
        .executeTakeFirst();
      if (!updated) throw app.httpErrors.notFound("Staff member not found.");
      return { ok: true as const };
    },
  );

  app.post(
    "/v1/identity/admin/users/:id/reset-password",
    {
      schema: {
        tags: ["identity-admin"],
        summary: "Set a new password for a staff account and end its sessions",
        params: idParams,
        body: resetPasswordBodySchema,
        response: { 200: okResponse },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const updated = await db
        .updateTable("identity.users")
        .set({ passwordHash: await hashPassword(request.body.password) })
        .where("id", "=", request.params.id)
        .where("role", "in", STAFF_ROLES)
        .returning("id")
        .executeTakeFirst();
      if (!updated) throw app.httpErrors.notFound("Staff member not found.");
      await db
        .updateTable("identity.refreshTokens")
        .set({ revokedAt: new Date() })
        .where("userId", "=", request.params.id)
        .where("revokedAt", "is", null)
        .execute();
      return { ok: true as const };
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
        const admin = requireRole(request, "admin");
        if (status === "blocked" && request.params.id === admin.userId) {
          throw conflict("You cannot block your own account.");
        }
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
