import {
  createService,
  createTokenVerifier,
  DEV_INTERNAL_KEY,
  DEV_JWT_SECRET,
  signIdentityHeaders,
  type Identity,
  type ServiceApp,
  type TokenVerifier,
} from "@qc/service-kit";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./config/env";
import { isAllowed, resolveRoute, type ServiceName } from "./routing";

const LOCAL_TARGETS: Record<ServiceName, string> = {
  identity: "http://localhost:4001",
  catalog: "http://localhost:4002",
  inventory: "http://localhost:4003",
  order: "http://localhost:4004",
  delivery: "http://localhost:4006",
  payment: "http://localhost:4005",
  notification: "http://localhost:4007",
  analytics: "http://localhost:4008",
};

function configuredTargets(): Record<ServiceName, string> {
  return {
    identity: env.IDENTITY_SERVICE_URL ?? LOCAL_TARGETS.identity,
    catalog: env.CATALOG_SERVICE_URL ?? LOCAL_TARGETS.catalog,
    inventory: env.WAREHOUSE_INVENTORY_SERVICE_URL ?? LOCAL_TARGETS.inventory,
    order: env.ORDER_SERVICE_URL ?? LOCAL_TARGETS.order,
    delivery: env.DELIVERY_SERVICE_URL ?? LOCAL_TARGETS.delivery,
    payment: env.PAYMENT_SERVICE_URL ?? LOCAL_TARGETS.payment,
    notification: env.NOTIFICATION_SERVICE_URL ?? LOCAL_TARGETS.notification,
    analytics: env.ANALYTICS_SERVICE_URL ?? LOCAL_TARGETS.analytics,
  };
}

// Only these request headers reach a service. Everything else, above all any x-user-* header a
// client might invent, is dropped, so identity can only come from the signed headers added below.
const FORWARDED = ["content-type", "accept", "accept-language", "idempotency-key", "user-agent"];
const UPSTREAM_TIMEOUT_MS = 10_000;

export type BuildAppOptions = {
  targets?: Partial<Record<ServiceName, string>>;
  verifier?: TokenVerifier;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<ServiceApp> {
  const production = env.NODE_ENV === "production";
  // Tokens come from our identity service (shared secret). A hosted JWKS is only for production
  // when no secret is set, so a leftover hosted-auth URL in a developer's env never takes over.
  const secret = env.JWT_SECRET ?? (production ? undefined : DEV_JWT_SECRET);
  const jwksUrl = !secret && production ? env.SUPABASE_JWKS_URL : undefined;
  if (!options.verifier && !secret && !jwksUrl) {
    throw new Error("JWT_SECRET (or SUPABASE_JWKS_URL) must be set in production.");
  }
  const verify = options.verifier ?? createTokenVerifier({ secret, jwksUrl });
  const targets = { ...configuredTargets(), ...options.targets };
  const internalKey = env.INTERNAL_API_KEY ?? DEV_INTERNAL_KEY;

  const app = await createService({ name: "gateway", env });

  // Keep request bodies exactly as sent, so they are forwarded byte for byte
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));

  const buckets = new Map<string, { count: number; resetAt: number }>();
  const overLimit = (key: string, limit: number): boolean => {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return false;
    }
    bucket.count += 1;
    return bucket.count > limit;
  };
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt < now) buckets.delete(key);
  }, 60_000);
  sweep.unref();
  app.addHook("onClose", async () => clearInterval(sweep));

  const fail = (
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
    requestId: string,
    status: number,
    code: string,
    message: string,
  ) => reply.status(status).send({ error: { code, message, requestId } });

  const proxy = async (request: FastifyRequest, reply: FastifyReply) => {
    const route = resolveRoute(request.method, request.url);
    if (!route) return fail(reply, request.id, 404, "NOT_FOUND", "No such route.");

    // Who is calling. A bad token is only an error on a route that needs one
    let identity: Identity | null = null;
    const bearer = route.anonymous
      ? undefined
      : /^Bearer (.+)$/i.exec(request.headers.authorization ?? "")?.[1];
    if (bearer) {
      try {
        const claims = await verify(bearer);
        identity = {
          userId: claims.sub,
          role: claims.app_role,
          warehouseId: claims.warehouse_id ?? null,
        };
      } catch {
        if (route.access !== "public") {
          return fail(reply, request.id, 401, "UNAUTHORIZED", "Sign in again to continue.");
        }
      }
    }
    if (route.access !== "public" && !identity) {
      return fail(reply, request.id, 401, "UNAUTHORIZED", "Sign in to continue.");
    }
    if (!isAllowed(route.access, identity?.role)) {
      return fail(reply, request.id, 403, "FORBIDDEN", "You are not allowed to do this.");
    }

    if (route.limit) {
      const who = identity?.userId ?? request.ip;
      if (overLimit(`${route.service}:${request.method}:${who}`, route.limit)) {
        reply.header("retry-after", "60");
        return fail(reply, request.id, 429, "RATE_LIMITED", "Too many requests. Slow down.");
      }
    }

    const headers: Record<string, string> = { "x-request-id": request.id };
    for (const name of [...FORWARDED, ...(route.extraHeaders ?? [])]) {
      const value = request.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    if (identity) Object.assign(headers, signIdentityHeaders(identity, internalKey));

    const hasBody = !["GET", "HEAD"].includes(request.method);
    let upstream: Response;
    try {
      upstream = await fetch(`${targets[route.service]}${request.url}`, {
        method: request.method,
        headers,
        body: hasBody && Buffer.isBuffer(request.body) ? new Uint8Array(request.body) : undefined,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      request.log.error({ err: error, service: route.service }, "upstream call failed");
      return timedOut
        ? fail(reply, request.id, 504, "GATEWAY_TIMEOUT", "The service took too long.")
        : fail(reply, request.id, 502, "BAD_GATEWAY", "The service is not reachable.");
    }

    const type = upstream.headers.get("content-type");
    if (type) reply.header("content-type", type);
    // Pass through the few response headers clients need: retry hints and file downloads
    for (const name of ["retry-after", "content-disposition", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) reply.header(name, value);
    }
    return reply.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
  };

  app.route({
    method: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    url: "/v1/*",
    // Room for a rider's door photo (base64). Each service still enforces its own, smaller limit
    // on every other route, so this only lets the photo upload through.
    bodyLimit: 2_400_000,
    handler: proxy,
  });
  app.route({ method: ["POST"], url: "/webhooks/*", handler: proxy });

  return app;
}
