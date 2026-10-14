import { addMonths, dateInMonth, monthOf, parts, type ISODate, type MonthKey } from "@/lib/dates";
import type { Cents } from "@/lib/money";

/**
 * Mês da fatura em que cai uma compra. É a regra da planilha:
 * DATA(ano; mês + (dia >= fechamento) + (vencimento <= fechamento); vencimento).
 * Com fechamento 30 e vencimento 6, compras até 29/10 vencem em 06/11 e de 30/10 em diante, em 06/12.
 */
export function mesDaFatura(dataCompra: ISODate, diaFecha: number, diaVence: number): MonthKey {
  const { d } = parts(dataCompra);
  const shift = (d >= diaFecha ? 1 : 0) + (diaVence <= diaFecha ? 1 : 0);
  return addMonths(monthOf(dataCompra), shift);
}

/**
 * Vencimento da fatura de um mês. Diferente da planilha, um vencimento no dia 30 em fevereiro
 * fica no último dia de fevereiro em vez de pular para março, para cada mês ter uma fatura só.
 */
export function vencimentoDaFatura(mes: MonthKey, diaVence: number): ISODate {
  return dateInMonth(mes, diaVence);
}

/** Fechamento da fatura que vence em `mes`. */
export function fechamentoDaFatura(mes: MonthKey, diaFecha: number, diaVence: number): ISODate {
  const mesFecha = diaVence <= diaFecha ? addMonths(mes, -1) : mes;
  return dateInMonth(mesFecha, diaFecha);
}

/** Divide o total em parcelas; os centavos que sobram vão na primeira. */
export function dividirParcelas(total: Cents, n: number): Cents[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("Número de parcelas inválido");
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + resto : base));
}

export interface ParcelaPlanejada {
  parcela: number;
  parcelas: number;
  valor: Cents;
  mesFatura: MonthKey;
}

/** Cada parcela cai uma fatura depois da anterior. */
export function planejarCompra(total: Cents, n: number, dataCompra: ISODate, diaFecha: number, diaVence: number): ParcelaPlanejada[] {
  const primeira = mesDaFatura(dataCompra, diaFecha, diaVence);
  return dividirParcelas(total, n).map((valor, i) => ({ parcela: i + 1, parcelas: n, valor, mesFatura: addMonths(primeira, i) }));
}

/** Conferência com o app do banco: positivo = falta lançar no app. */
export function diferencaConferencia(totalNoBanco: Cents, totalLancado: Cents): Cents {
  return totalNoBanco - totalLancado;
}
