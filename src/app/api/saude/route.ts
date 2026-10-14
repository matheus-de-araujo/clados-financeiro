import { sql } from "drizzle-orm";
import { getDb, isDemo, emMemoria } from "@/db";

export const dynamic = "force-dynamic";

/** Diz se o banco responde e quanto há nele; não mostra nenhum valor. */
export async function GET() {
  const db = await getDb();
  const r = await db.execute(sql`select (select count(*) from "user")::int as usuarios, (select count(*) from lancamentos)::int as lancamentos, (select count(*) from contas_mes)::int as contas`);
  const linha = (Array.isArray(r) ? r[0] : (r as { rows: unknown[] }).rows[0]) as Record<string, number>;
  return Response.json({ ok: true, banco: emMemoria ? "memoria" : "neon", demo: isDemo, ...linha });
}
