import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations.generated";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

/** Sem DATABASE_URL o app usa um Postgres em memória (PGlite) com dados de demonstração. */
export const emMemoria = !process.env.DATABASE_URL;
/** Dados de demonstração: no banco em memória ou no Neon com SEED_DEMO=1 (enquanto não entra em uso de verdade). */
export const isDemo = emMemoria || process.env.SEED_DEMO === "1";

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
    const db = drizzle({ client: pool, schema }) as unknown as DB;
    if (isDemo) await semearUmaVez(db);
    return db;
  }
  const db = await createMemoryDb();
  const { seedDemo } = await import("./seed");
  await seedDemo(db);
  return db;
}

/**
 * Carrega a demonstração no Neon se ainda não houver ninguém cadastrado. Roda uma vez por servidor,
 * com uma consulta só; se dois servidores novos tentarem carregar juntos, o segundo falha no e-mail
 * repetido e o próximo acesso já encontra os dados.
 */
async function semearUmaVez(db: DB) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.user);
  if (n === 0) {
    const { seedDemo } = await import("./seed");
    await seedDemo(db);
  }
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
