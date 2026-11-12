import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

export const INTERNAL_KEY_HEADER = "x-internal-key";

function sameKey(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Guards every /internal/* route. The gateway never proxies /internal/*, so only another service
 * holding the shared key can call them. With no key configured it allows calls in development and
 * refuses all of them in production, so a missing secret can never leave internal routes open.
 */
export function registerInternalAuth(
  app: FastifyInstance,
  options: { apiKey: string | undefined; production: boolean },
): void {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/internal/")) return;

    if (!options.apiKey) {
      if (options.production) {
        return reply.status(503).send({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Internal calls are not configured.",
            requestId: request.id,
          },
        });
      }
      return;
    }

    const supplied = request.headers[INTERNAL_KEY_HEADER];
    if (typeof supplied !== "string" || !sameKey(supplied, options.apiKey)) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or wrong internal key.",
          requestId: request.id,
        },
      });
    }
  });
}
