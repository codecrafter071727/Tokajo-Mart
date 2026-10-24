import { defineConfig } from "eslint/config";
import globals from "globals";
import base from "./base.js";

export default defineConfig(
  base,
  { languageOptions: { globals: globals.node } },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-exports": [
        "error",
        { restrictDefaultExports: { direct: true, named: true, defaultFrom: true } },
      ],
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Read config from src/config/env.ts." },
      ],
    },
  },
  {
    files: ["src/config/env.ts"],
    rules: { "no-restricted-properties": "off" },
  },
);
