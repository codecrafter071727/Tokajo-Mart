import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import underPressure from "@fastify/under-pressure";
import * as Sentry from "@sentry/node";
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type RawServerDefault,
} from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { BaseEnv } from "./env";
import { registerErrorHandler } from "./errors";
import { registerHealthRoutes } from "./health";
import { buildLoggerOptions } from "./logger";

export type CreateServiceOptions = {
  name: string;
  version?: string;
  env: BaseEnv;
  readinessCheck?: () => Promise<
    boolean | { ready: boolean; database: "ok" | "unready" | "skipped" }
  >;
};

export type ServiceApp = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export async function createService(options: CreateServiceOptions): Promise<ServiceApp> {
  const { name, env, version = "0.0.0", readinessCheck } = options;

  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.APP_ENV,
      serverName: name,
      release: version,
    });
  }

  const app = Fastify({
    logger: buildLoggerOptions({ service: name, level: env.LOG_LEVEL }),
    genReqId: (request) => {
      const header = request.headers["x-request-id"];
      return typeof header === "string" && header.length > 0 ? header : randomUUID();
    },
    requestIdHeader: "x-request-id",
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production",
  });
  await app.register(cors, {
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
  });
  await app.register(sensible);
  await app.register(underPressure, {
    exposeStatusRoute: false,
    // 0 disables a check. Event-loop delay is off in tests so parallel Vitest
    // workers do not trip a 503 on /health/live.
    maxEventLoopDelay: env.NODE_ENV === "test" ? 0 : 1000,
    maxHeapUsedBytes: 0,
    maxRssBytes: 0,
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    allowList: (request) => request.url.startsWith("/health"),
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: `@qc/${name}`,
        version,
      },
    },
    transform: jsonSchemaTransform,
  });

  if (env.NODE_ENV !== "production") {
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  registerErrorHandler(app);
  registerHealthRoutes(app, { service: name, readinessCheck });

  if (env.SENTRY_DSN) {
    Sentry.setupFastifyErrorHandler(app);
  }

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  return app;
}

export async function startService(app: ServiceApp, port: number): Promise<void> {
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({ host: "0.0.0.0", port });
}
