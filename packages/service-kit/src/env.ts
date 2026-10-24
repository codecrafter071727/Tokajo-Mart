import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

export const optionalString = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const optionalUrl = () => z.preprocess(emptyToUndefined, z.url().optional());

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  APP_ENV: z.enum(["local", "staging", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  SENTRY_DSN: optionalUrl(),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export type ServiceEnvAliases = {
  portKey: string;
  databaseUrlKey?: string;
};

export function findRepoRoot(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

function parseEnvFile(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function readRootEnvFile(cwd: string): Record<string, string> {
  const root = findRepoRoot(cwd);
  if (!root) {
    return {};
  }
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    return {};
  }
  return parseEnvFile(readFileSync(envPath, "utf8"));
}

export function loadEnv<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return result.data;
}

function missing(value: string | undefined): boolean {
  return value == null || value === "";
}

export function loadServiceEnv<T extends z.ZodType>(
  schema: T,
  source: NodeJS.ProcessEnv,
  aliases: ServiceEnvAliases,
  cwd: string,
): z.infer<T> {
  const fromFile = readRootEnvFile(cwd);
  const merged: NodeJS.ProcessEnv = { ...fromFile, ...source };

  if (missing(merged.PORT)) {
    merged.PORT = merged[aliases.portKey];
  }
  if (aliases.databaseUrlKey && missing(merged.DATABASE_URL)) {
    merged.DATABASE_URL = merged[aliases.databaseUrlKey];
  }

  return loadEnv(schema, merged);
}
