import { deleteAccountBodySchema, deleteAccountResponseSchema } from "@qc/contracts";
import { requireIdentity, type Kysely, type ServiceApp } from "@qc/service-kit";
import { env } from "../../config/env";
import type { DB } from "../../db/types.generated";
import { deleteCustomerAccount, type DeletionClients } from "./deletion";

export function registerAccountRoutes(
  app: ServiceApp,
  db: Kysely<DB>,
  clients: DeletionClients,
  now: () => Date,
): void {
  app.post(
    "/v1/identity/me/delete",
    {
      // Deleting is rare and irreversible: a tight limit stops anything scripted
      config: { rateLimit: { max: env.NODE_ENV === "test" ? 10_000 : 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["identity"],
        summary: "Delete my account (customers)",
        body: deleteAccountBodySchema,
        response: { 200: deleteAccountResponseSchema },
      },
    },
    async (request) => {
      const { deletedAt } = await deleteCustomerAccount(
        db,
        clients,
        requireIdentity(request),
        request.body.reason,
        now(),
      );
      return { deleted: true as const, deletedAt: deletedAt.toISOString() };
    },
  );
}
