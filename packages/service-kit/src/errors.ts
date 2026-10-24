import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import type { FastifyError, FastifyInstance } from "fastify";
import type { ErrorCode } from "@qc/contracts";

function statusToCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_ERROR";
  }
}

function statusOf(error: FastifyError): number {
  if (typeof error.statusCode === "number" && error.statusCode >= 400) {
    return error.statusCode;
  }
  return 500;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR" satisfies ErrorCode,
          message: "Request validation failed.",
          details: error.validation,
          requestId: request.id,
        },
      });
    }

    const statusCode = statusOf(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, error.message);
    } else {
      request.log.warn({ err: error }, error.message);
    }

    return reply.status(statusCode).send({
      error: {
        code: statusToCode(statusCode),
        message: statusCode >= 500 ? "An unexpected error occurred." : error.message,
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND" satisfies ErrorCode,
        message: "Route not found.",
        requestId: request.id,
      },
    });
  });
}
