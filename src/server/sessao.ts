import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, isDemo, type DB } from "@/db";
import { espacos, membros } from "@/db/schema";
import { hojeDemo } from "@/db/seed";
import { isMonthKey, monthOf, todayISO, type ISODate, type MonthKey } from "@/lib/dates";
import { getAuth } from "./auth";
import type { TipoEspaco } from "./base";

export type Papel = "edita" | "ve";

export interface Sessao {
  db: DB;
  user: { id: string; name: string; email: string };
  acesso: Record<TipoEspaco, Papel | null>;
  padrao: TipoEspaco;
  hoje: ISODate;
  demo: boolean;
}

export function hoje(): ISODate {
  return isDemo ? hojeDemo() : todayISO();
}

export async function getSessao(): Promise<Sessao | null> {
  // Ler os cabeçalhos primeiro deixa a página dinâmica antes de tocar no banco (nada é pré-gerado no build).
  const h = await headers();
  const db = await getDb();
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: h });
  if (!s) return null;
  const ms = await db.select({ papel: membros.papel, padrao: membros.padrao, tipo: espacos.tipo }).from(membros).innerJoin(espacos, eq(espacos.id, membros.espacoId)).where(eq(membros.userId, s.user.id));
  const acesso: Record<TipoEspaco, Papel | null> = { clados: null, casa: null };
  let padrao: TipoEspaco | null = null;
  for (const m of ms) {
    acesso[m.tipo as TipoEspaco] = m.papel as Papel;
    if (m.padrao) padrao = m.tipo as TipoEspaco;
  }
  return {
    db,
    user: { id: s.user.id, name: s.user.name, email: s.user.email },
    acesso,
    padrao: padrao ?? (acesso.clados ? "clados" : "casa"),
    hoje: hoje(),
    demo: isDemo,
  };
}

/** Para páginas: exige login e acesso ao espaço. */
export async function exigirSessao(espaco?: TipoEspaco): Promise<Sessao> {
  const s = await getSessao();
  if (!s) redirect("/entrar");
  if (espaco && !s.acesso[espaco]) redirect(`/${s.padrao}`);
  return s;
}

/** Para telas de lançamento: exige poder editar o espaço. */
export async function exigirEdicao(espaco: TipoEspaco): Promise<Sessao> {
  const s = await exigirSessao(espaco);
  if (s.acesso[espaco] !== "edita") redirect(`/${espaco}`);
  return s;
}

export function mesDaUrl(sp: { m?: string | string[] } | undefined, hojeISO: ISODate): MonthKey {
  const m = typeof sp?.m === "string" ? sp.m : undefined;
  return isMonthKey(m) ? m : monthOf(hojeISO);
}
