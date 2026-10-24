import { createDatabaseReadinessCheck, createService } from "@qc/service-kit";
import { env } from "./config/env";

export async function buildApp() {
  return createService({
    name: "catalog",
    env,
    readinessCheck: createDatabaseReadinessCheck({
      databaseUrl: env.DATABASE_URL,
      enabled: env.NODE_ENV !== "test",
    }),
  });
}
