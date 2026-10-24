import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { pingPostgres } from "./db";

const checkSchema = z.enum(["ok", "unready", "skipped"]);

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "unready"]),
  service: z.string(),
  checks: z.object({
    process: checkSchema,
    database: checkSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export type ReadinessResult = {
  ready: boolean;
  database: z.infer<typeof checkSchema>;
};

export function createDatabaseReadinessCheck(input: {
  databaseUrl?: string;
  enabled: boolean;
}): () => Promise<ReadinessResult> {
  return async () => {
    if (!input.enabled || input.databaseUrl == null || input.databaseUrl.length === 0) {
      return { ready: true, database: "skipped" };
    }
    const ok = await pingPostgres(input.databaseUrl);
    return { ready: ok, database: ok ? "ok" : "unready" };
  };
}

function normalizeReadiness(result: boolean | ReadinessResult | undefined): ReadinessResult {
  if (result == null) {
    return { ready: true, database: "skipped" };
  }
  if (typeof result === "boolean") {
    return { ready: result, database: result ? "ok" : "unready" };
  }
  return result;
}

export function registerHealthRoutes(
  app: FastifyInstance,
  input: {
    service: string;
    readinessCheck?: () => Promise<boolean | ReadinessResult>;
  },
): void {
  app.get(
    "/health/live",
    {
      logLevel: "silent",
      schema: {
        tags: ["health"],
        summary: "Liveness probe",
        description: "Returns 200 if the process is running.",
        response: { 200: healthResponseSchema },
      },
    },
    async () => ({
      status: "ok" as const,
      service: input.service,
      checks: { process: "ok" as const, database: "skipped" as const },
    }),
  );

  app.get(
    "/health/ready",
    {
      logLevel: "silent",
      schema: {
        tags: ["health"],
        summary: "Readiness probe",
        description:
          "Returns 200 if the process can take traffic. Database is probed when DATABASE_URL is set.",
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    async (_request, reply) => {
      const readiness = normalizeReadiness(
        input.readinessCheck ? await input.readinessCheck() : undefined,
      );

      const body = {
        status: readiness.ready ? ("ok" as const) : ("unready" as const),
        service: input.service,
        checks: { process: "ok" as const, database: readiness.database },
      };

      if (!readiness.ready) {
        return reply.status(503).send(body);
      }
      return body;
    },
  );
}
