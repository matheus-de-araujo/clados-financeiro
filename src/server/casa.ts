import { and, asc, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { categorias, contasMes, faturas, lancamentos } from "@/db/schema";
import { resumoCasa, type ResumoCasa, type TipoConta } from "@/domain/casa";
import { fechamentoDaFatura, vencimentoDaFatura } from "@/domain/cartao";
import { firstDay, lastDay, type ISODate, type MonthKey } from "@/lib/dates";
import { sum, type Cents } from "@/lib/money";
import { anteriorDoMes, getEspaco, getFechamento, listCartoes, saldoConta, saldoReserva, type Cartao, type Espaco } from "./base";
import { gerarAoRedor } from "./gerar";

export type ContaMes = typeof contasMes.$inferSelect;

export interface FaturaDoMes {
  cartao: Cartao;
  mes: MonthKey;
  vencimento: ISODate;
  fechamento: ISODate;
  total: Cents;
  qtd: number;
  pagoEm: ISODate | null;
  valorPago: Cents | null;
  conferidoValor: Cents | null;
  conferidoEm: ISODate | null;
}

/** Fatura de um cartão num mês (total das compras com vencimento nesse mês). */
export async function faturaDoMes(db: DB, cartao: Cartao, mes: MonthKey): Promise<FaturaDoMes> {
  const [[t], [f]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${lancamentos.valor}),0)`.mapWith(Number), qtd: sql<number>`count(*)`.mapWith(Number) })
      .from(lancamentos)
      .where(and(eq(lancamentos.cartaoId, cartao.id), eq(lancamentos.tipo, "compra"), eq(lancamentos.mesFatura, mes))),
    db.select().from(faturas).where(and(eq(faturas.cartaoId, cartao.id), eq(faturas.mes, mes))),
  ]);
  return {
    cartao,
    mes,
    vencimento: vencimentoDaFatura(mes, cartao.diaVence),
    fechamento: fechamentoDaFatura(mes, cartao.diaFecha, cartao.diaVence),
    total: t.total,
    qtd: t.qtd,
    pagoEm: f?.pagoEm ?? null,
    valorPago: f?.valorPago ?? null,
    conferidoValor: f?.conferidoValor ?? null,
    conferidoEm: f?.conferidoEm ?? null,
  };
}

export async function faturasDoEspaco(db: DB, espaco: Espaco, mes: MonthKey): Promise<FaturaDoMes[]> {
  const cs = await listCartoes(db, espaco.id, { inativos: true });
  const fs = await Promise.all(cs.map((c) => faturaDoMes(db, c, mes)));
  // Cartão fora de uso só aparece nos meses em que teve compras.
  return fs.filter((f) => f.cartao.ativo || f.qtd > 0 || f.pagoEm);
}

export async function contasDoMes(db: DB, espacoId: number, mes: MonthKey): Promise<ContaMes[]> {
  return db.select().from(contasMes).where(and(eq(contasMes.espacoId, espacoId), eq(contasMes.mes, mes))).orderBy(asc(contasMes.vencimento), asc(contasMes.id));
}

async function somaLanc(db: DB, conds: Parameters<typeof and>): Promise<Cents> {
  const [r] = await db
    .select({ v: sql<number>`coalesce(sum(${lancamentos.valor}),0)`.mapWith(Number) })
    .from(lancamentos)
    .where(and(...conds));
  return r.v;
}

export interface MesCasa {
  espaco: Espaco;
  mes: MonthKey;
  saldoConta: Cents;
  reserva: Cents;
  resumo: ResumoCasa;
  /** Resultado só deste mês, sem a sobra ou falta trazida (o número que a planilha mostrava). */
  resultadoDoMes: Cents;
  anterior: Cents;
  retiradas: Cents;
  outrasEntradas: Cents;
  contas: ContaMes[];
  faturas: FaturaDoMes[];
  fechamento: Awaited<ReturnType<typeof getFechamento>>;
}

export async function mesCasa(db: DB, mes: MonthKey, hoje?: ISODate): Promise<MesCasa> {
  const espaco = await getEspaco(db, "casa");
  await gerarAoRedor(db, espaco, mes);
  const ini = firstDay(mes);
  const fim = lastDay(mes);
  const noMes = [eq(lancamentos.espacoId, espaco.id), gte(lancamentos.data, ini), lte(lancamentos.data, fim)] as const;

  const [contas, fats, retiradas, outras, avulsos, anterior, fechamento, saldo, reserva] = await Promise.all([
    contasDoMes(db, espaco.id, mes),
    faturasDoEspaco(db, espaco, mes),
    somaLanc(db, [...noMes, eq(lancamentos.tipo, "entrada"), isNotNull(lancamentos.retiradaId)]),
    somaLanc(db, [...noMes, eq(lancamentos.tipo, "entrada"), isNull(lancamentos.retiradaId)]),
    somaLanc(db, [...noMes, eq(lancamentos.tipo, "saida"), isNull(lancamentos.contaMesId)]),
    anteriorDoMes(db, espaco.id, mes),
    getFechamento(db, espaco.id, mes),
    saldoConta(db, espaco, hoje),
    saldoReserva(db, espaco, hoje),
  ]);

  const resumo = resumoCasa({
    contas: contas.map((c) => ({ valor: c.valor, tipo: c.tipo as TipoConta, pago: !!c.pagoEm, valorPago: c.valorPago, percentual: c.percentual })),
    faturas: fats.map((f) => f.total),
    gastosAvulsos: avulsos,
    retiradas,
    outrasEntradas: outras,
    anterior,
  });

  return {
    espaco,
    mes,
    saldoConta: saldo,
    reserva,
    resumo,
    resultadoDoMes: resumo.resultado - anterior,
    anterior,
    retiradas,
    outrasEntradas: outras,
    contas,
    faturas: fats,
    fechamento,
  };
}

/** Valor que aparece numa conta do mês: o pago, ou o previsto (o dízimo usa o previsto do resumo). */
export function valorDaConta(c: ContaMes, resumo: ResumoCasa): Cents {
  if (c.pagoEm && c.valorPago != null) return c.valorPago;
  if (c.tipo === "dizimo") return resumo.dizimo;
  return c.valor;
}

export async function comprasDaFatura(db: DB, cartaoId: number, mes: MonthKey) {
  return db
    .select({ l: lancamentos, categoria: categorias.nome })
    .from(lancamentos)
    .leftJoin(categorias, eq(categorias.id, lancamentos.categoriaId))
    .where(and(eq(lancamentos.cartaoId, cartaoId), eq(lancamentos.tipo, "compra"), eq(lancamentos.mesFatura, mes)))
    .orderBy(desc(lancamentos.data), desc(lancamentos.id));
}

export async function porCategoria(db: DB, cartaoId: number, mes: MonthKey) {
  const rows = await comprasDaFatura(db, cartaoId, mes);
  const map = new Map<string, Cents>();
  for (const r of rows) map.set(r.categoria ?? "Sem categoria", (map.get(r.categoria ?? "Sem categoria") ?? 0) + r.l.valor);
  return [...map.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
}

export async function extrato(db: DB, espacoId: number, mes: MonthKey) {
  return db
    .select({ l: lancamentos, categoria: categorias.nome })
    .from(lancamentos)
    .leftJoin(categorias, eq(categorias.id, lancamentos.categoriaId))
    .where(and(eq(lancamentos.espacoId, espacoId), gte(lancamentos.data, firstDay(mes)), lte(lancamentos.data, lastDay(mes))))
    .orderBy(desc(lancamentos.data), desc(lancamentos.id));
}

export async function totalLancadoAte(db: DB, cartaoId: number, mes: MonthKey): Promise<Cents> {
  const rows = await comprasDaFatura(db, cartaoId, mes);
  return sum(rows.map((r) => r.l.valor));
}

export async function categoriasDo(db: DB, espacoId: number) {
  return db.select().from(categorias).where(eq(categorias.espacoId, espacoId)).orderBy(categorias.ordem, categorias.id);
}

