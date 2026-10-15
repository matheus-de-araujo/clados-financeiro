// Troca a Casa de um banco Neon pelos dados das planilhas. Só roda quando chamado de propósito:
//   IMPORTAR_CASA_URL=<conexão> [SALDO_HOJE=123456] [RESERVA_HOJE=225000] npx vitest run scripts/importar-casa.test.ts
// SALDO_HOJE e RESERVA_HOJE em centavos: ajustam o saldo inicial para a conta bater com o banco hoje.
import { it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { getEspaco, saldoConta } from "@/server/base";
import { importarCasa, limparCasa } from "@/server/importar-casa";
import { todayISO } from "@/lib/dates";

const url = process.env.IMPORTAR_CASA_URL;

it.runIf(!!url)("importa as planilhas da Casa", async () => {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  neonConfig.webSocketConstructor = (await import("ws")).default;
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema }) as unknown as DB;
  const hoje = process.env.HOJE ?? todayISO();
  await limparCasa(db);
  const rel = await importarCasa(db, { hoje, reservaInicial: Number(process.env.RESERVA_HOJE ?? 0) });
  console.table(rel.map((r) => ({ mes: r.mes, esperado: r.esperado, app: r.app, ok: r.esperado === r.app })));
  if (process.env.SALDO_HOJE) {
    const casa = await getEspaco(db, "casa");
    const calculado = await saldoConta(db, casa, hoje);
    await db.update(schema.espacos).set({ saldoInicial: Number(process.env.SALDO_HOJE) - calculado }).where(eq(schema.espacos.id, casa.id));
  }
  await pool.end();
}, 600_000);
