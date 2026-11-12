import {
  authResponseSchema,
  authUserSchema,
  otpRequestBodySchema,
  otpRequestResponseSchema,
  otpVerifyBodySchema,
  passwordLoginBodySchema,
  refreshBodySchema,
} from "@qc/contracts";
import { requireIdentity, type ServiceApp } from "@qc/service-kit";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { DB } from "../../db/types.generated";
import { env } from "../../config/env";
import { forbidden } from "./errors";
import type { AuthService } from "./service";

/** Sign in is the most attacked route, so it gets a much tighter rate limit than the rest. */
const strict = {
  rateLimit: { max: env.NODE_ENV === "test" ? 10_000 : 10, timeWindow: "1 minute" },
};

export function registerAuthRoutes(app: ServiceApp, auth: AuthService, db: Kysely<DB>): void {
  app.post(
    "/v1/identity/auth/otp/request",
    {
      config: strict,
      schema: {
        tags: ["identity"],
        summary: "Send a sign in code to a phone",
        body: otpRequestBodySchema,
        response: { 200: otpRequestResponseSchema },
      },
    },
    async (request) => auth.requestOtp(request.body.phone, request.body.role),
  );

  app.post(
    "/v1/identity/auth/otp/verify",
    {
      config: strict,
      schema: {
        tags: ["identity"],
        summary: "Sign in with the code",
        body: otpVerifyBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) => auth.verifyOtp(request.body),
  );

  app.post(
    "/v1/identity/auth/login",
    {
      config: strict,
      schema: {
        tags: ["identity"],
        summary: "Staff and admin sign in",
        body: passwordLoginBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) => auth.loginWithPassword(request.body.email, request.body.password),
  );

  app.post(
    "/v1/identity/auth/refresh",
    {
      config: strict,
      schema: {
        tags: ["identity"],
        summary: "Get a new token pair",
        body: refreshBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) => auth.refresh(request.body.refreshToken),
  );

  app.post(
    "/v1/identity/auth/logout",
    {
      schema: {
        tags: ["identity"],
        summary: "End this session",
        body: refreshBodySchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      await auth.logout(request.body.refreshToken);
      return { ok: true as const };
    },
  );

  app.get(
    "/v1/identity/me",
    { schema: { tags: ["identity"], summary: "Who am I", response: { 200: authUserSchema } } },
    async (request) => {
      const identity = requireIdentity(request);
      const user = await db
        .selectFrom("identity.users")
        .selectAll()
        .where("id", "=", identity.userId)
        .executeTakeFirst();
      if (!user || user.status !== "active") throw forbidden("This account is not active.");
      return {
        id: user.id,
        role: user.role as never,
        name: user.name,
        phone: user.phone,
        email: user.email,
        warehouseId: user.warehouseId ?? identity.warehouseId,
      };
    },
  );
}
