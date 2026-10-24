import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      APP_ENV: "local",
      LOG_LEVEL: "silent",
      PORT: "4001",
    },
  },
});
