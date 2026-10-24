import type { FastifyServerOptions } from "fastify";

export function buildLoggerOptions(input: {
  service: string;
  level: string;
}): FastifyServerOptions["logger"] {
  return {
    level: input.level,
    base: { service: input.service },
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "req.headers['x-internal-token']"],
      censor: "[redacted]",
    },
  };
}
