import { startService } from "@qc/service-kit";
import { buildApp } from "./app";
import { env } from "./config/env";

const app = await buildApp();
await startService(app, env.PORT);
