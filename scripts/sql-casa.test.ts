// Gera o SQL que troca a Casa de um banco pelos dados das planilhas, para rodar onde este container
// não alcança o banco direto (ex.: pelo console do Neon). Só roda quando chamado de propósito:
//   SQL_CASA=saida.sql [HOJE=2026-10-15] [SALDO_HOJE=centavos] [RESERVA_HOJE=centavos] npx vitest run scripts/sql-casa.test.ts
// Pressupõe que o banco de destino nasceu da demonstração (mesmos ids de espaços, cartões e categorias).
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createMemoryDb, schema } from "@/db";
import { seedDemo } from "@/db/seed";
import { getEspaco, saldoConta } from "@/server/base";
import { importarCasa, limparCasa } from "@/server/importar-casa";
import { todayISO } from "@/lib/dates";

const saida = process.env.SQL_CASA;
// Ids novos começam bem acima dos que existem no destino, para não colidir.
const INICIO: Record<string, number> = { cartoes: 50, contas_fixas: 500, contas_mes: 5000, lancamentos: 50000, faturas: 5000, fechamentos: 500 };

it.runIf(!!saida)("gera o SQL da Casa", async () => {
  const hoje = process.env.HOJE ?? todayISO();
  const db = await createMemoryDb();
  await seedDemo(db);
  const casa = await getEspaco(db, "casa");
  expect(casa.id).toBe(2);
  await limparCasa(db);
  for (const [t, n] of Object.entries(INICIO)) await db.execute(sql.raw(`select setval('${t}_id_seq', ${n})`));
  const rel = await importarCasa(db, { hoje, reservaInicial: Number(process.env.RESERVA_HOJE ?? 0) });
  for (const r of rel) expect([r.mes, r.app]).toEqual([r.mes, r.esperado]);
  if (process.env.SALDO_HOJE) {
    const calc = await saldoConta(db, casa, hoje);
    await db.update(schema.espacos).set({ saldoInicial: Number(process.env.SALDO_HOJE) - calc }).where(sql`id = ${casa.id}`);
  }

  const linhas = async (q: string) => ((await db.execute(sql.raw(`select coalesce(json_agg(t), '[]'::json) as j from (${q}) t`))) as unknown as { rows: { j: unknown }[] }).rows[0].j;
  const lit = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  const esp = ((await db.execute(sql`select data_inicio::text as d, saldo_inicial as s, reserva_inicial as r from espacos where id = ${casa.id}`)) as unknown as { rows: { d: string; s: number; r: number }[] }).rows[0];

  const out: string[] = [
    "begin;",
    "delete from faturas where cartao_id in (select id from cartoes where espaco_id = 2);",
    "delete from lancamentos where espaco_id = 2 and retirada_id is null;",
    "delete from contas_mes where espaco_id = 2;",
    "delete from contas_fixas where espaco_id = 2;",
    "delete from fechamentos where espaco_id = 2;",
    `update espacos set data_inicio = '${esp.d}', saldo_inicial = ${esp.s}, reserva_inicial = ${esp.r} where id = 2;`,
  ];
  for (const t of ["cartoes", "contas_fixas", "contas_mes", "lancamentos", "faturas", "fechamentos"]) {
    const j = await linhas(`select * from ${t} where id > ${INICIO[t]} order by id`);
    out.push(`insert into ${t} select * from json_populate_recordset(null::${t}, ${lit(j)});`);
    out.push(`select setval('${t}_id_seq', (select max(id) from ${t}));`);
  }
  out.push("commit;");
  writeFileSync(saida!, out.join("\n") + "\n");
  console.log("SQL gerado:", saida, out.join("\n").length, "bytes");
}, 600_000);
