import type { DB } from "@/db";
import { mesDaFatura } from "@/domain/cartao";
import { addMonths, type ISODate } from "@/lib/dates";
import type { Cartao } from "./base";
import { faturaDoMes, type FaturaDoMes } from "./casa";

export type EstadoFatura = "fechada" | "aberta" | "paga";

/**
 * A fatura que importa agora: a mais antiga fechada e não paga; se não houver, a aberta.
 * Logo depois de pagar, mostra a paga até ela vencer.
 */
export async function faturaEmFoco(db: DB, cartao: Cartao, hoje: ISODate): Promise<{ fatura: FaturaDoMes; estado: EstadoFatura }> {
  const aberta = mesDaFatura(hoje, cartao.diaFecha, cartao.diaVence);
  for (const m of [addMonths(aberta, -2), addMonths(aberta, -1)]) {
    const f = await faturaDoMes(db, cartao, m);
    if (f.total > 0 && !f.pagoEm) return { fatura: f, estado: "fechada" };
  }
  const anterior = await faturaDoMes(db, cartao, addMonths(aberta, -1));
  if (anterior.pagoEm && anterior.vencimento >= hoje) return { fatura: anterior, estado: "paga" };
  const f = await faturaDoMes(db, cartao, aberta);
  return { fatura: f, estado: f.pagoEm ? "paga" : "aberta" };
}

export async function proximasFaturas(db: DB, cartao: Cartao, depoisDe: string, n = 2) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(await faturaDoMes(db, cartao, addMonths(depoisDe, i)));
  return out;
}
