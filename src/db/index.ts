import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations.generated";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

/** Sem DATABASE_URL o app usa um Postgres em memória (PGlite) com dados de demonstração. */
export const isDemo = !process.env.DATABASE_URL;

/** Banco novo em memória, com as tabelas criadas e vazio. Usado nos testes e na demonstração. */
export async function createMemoryDb(): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  for (const stmt of MIGRATIONS) await client.exec(stmt);
  return drizzle({ client, schema }) as unknown as DB;
}

async function init(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const ws = (await import("ws")).default;
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle({ client: pool, schema }) as unknown as DB;
  }
  const db = await createMemoryDb();
  const { seedDemo } = await import("./seed");
  await seedDemo(db);
  return db;
}

const g = globalThis as unknown as { __financeiroDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__financeiroDb) {
    g.__financeiroDb = init().catch((err) => {
      g.__financeiroDb = undefined;
      throw err;
    });
  }
  return g.__financeiroDb;
}
