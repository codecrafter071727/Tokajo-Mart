import { createService } from "@qc/service-kit";
import { env } from "./config/env";

export async function buildApp() {
  return createService({ name: "gateway", env });
}
