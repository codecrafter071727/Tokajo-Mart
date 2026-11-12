import { Client } from "pg";

export async function pingPostgres(databaseUrl: string, timeoutMs = 2000): Promise<boolean> {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: timeoutMs,
  });

  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

/**
 * A Kysely instance for one service. snake_case in the database, camelCase in code, as the
 * architecture requires. Keep the pool small: Postgres connections are the scarce resource.
 */
export function createDb<DB>(databaseUrl: string, poolMax = 5): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl, max: poolMax }),
    }),
    plugins: [new CamelCasePlugin()],
  });
}

export type { Kysely, Transaction } from "kysely";
