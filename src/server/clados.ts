import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { clientes, contasFixas, contasMes, contratos, horas, lancamentos, recebiveis } from "@/db/schema";
import { faturamentoNecessario, podeRetirar, situacaoMei, valorHoras } from "@/domain/clados";
import { addDays, addMonths, firstDay, lastDay, monthOf, type ISODate, type MonthKey } from "@/lib/dates";
import { sum, type Cents } from "@/lib/money";
import { getEspaco, listCartoes, saldoConta, type Espaco } from "./base";
import { faturaDoMes, mesCasa, type MesCasa } from "./casa";
import { fixaAtivaNoMes, gerarAoRedor } from "./gerar";

export type Recebivel = typeof recebiveis.$inferSelect;
export type Contrato = typeof contratos.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;

/** Total mensal das contas fixas da Clados num mês (no cartão ou boleto). */
export async function fixasClados(db: DB, espaco: Espaco, mes: MonthKey): Promise<Cents> {
  const fs = await db.select().from(contasFixas).where(eq(contasFixas.espacoId, espaco.id));
  return sum(fs.filter((f) => fixaAtivaNoMes(f, mes)).map((f) => f.valor));
}

/** Contas da Clados não pagas e faturas do cartão Clados não pagas que vencem até hoje + 30 dias. */
export async function comprometido(db: DB, espaco: Espaco, hoje: ISODate): Promise<{ total: Cents; contas: Cents; faturas: Cents }> {
  const limite = addDays(hoje, 30);
  const mesHoje = monthOf(hoje);
  const meses = [addMonths(mesHoje, -1), mesHoje, addMonths(mesHoje, 1)];
  const [[c], fats] = await Promise.all([
    db
      .select({ v: sql<number>`coalesce(sum(${contasMes.valor}),0)`.mapWith(Number) })
      .from(contasMes)
      .where(and(eq(contasMes.espacoId, espaco.id), isNull(contasMes.pagoEm), lte(contasMes.vencimento, limite))),
    listCartoes(db, espaco.id).then((cs) => Promise.all(cs.flatMap((cartao) => meses.map((mes) => faturaDoMes(db, cartao, mes))))),
  ]);
  let fat = 0;
  for (const f of fats) if (!f.pagoEm && f.vencimento <= limite && f.total > 0) fat += f.total;
  return { total: c.v + fat, contas: c.v, faturas: fat };
}

export async function faturadoNoAno(db: DB, espaco: Espaco, ano: number): Promise<Cents> {
  const [r] = await db
    .select({ v: sql<number>`coalesce(sum(${lancamentos.valor}),0)`.mapWith(Number) })
    .from(lancamentos)
    .where(and(eq(lancamentos.espacoId, espaco.id), eq(lancamentos.tipo, "entrada"), gte(lancamentos.data, `${ano}-01-01`), lte(lancamentos.data, `${ano}-12-31`)));
  return r.v;
}

export async function retiradoNoMes(db: DB, espaco: Espaco, mes: MonthKey): Promise<Cents> {
  const [r] = await db
    .select({ v: sql<number>`coalesce(sum(${lancamentos.valor}),0)`.mapWith(Number) })
    .from(lancamentos)
    .where(and(eq(lancamentos.espacoId, espaco.id), eq(lancamentos.tipo, "retirada"), gte(lancamentos.data, firstDay(mes)), lte(lancamentos.data, lastDay(mes))));
  return r.v;
}

export interface HorasAbertas {
  contrato: Contrato;
  cliente: Cliente;
  minutos: number;
  valor: Cents;
}

export async function horasNaoCobradas(db: DB): Promise<HorasAbertas[]> {
  const rows = await db
    .select({ contrato: contratos, cliente: clientes, minutos: sql<number>`coalesce(sum(${horas.minutos}),0)`.mapWith(Number) })
    .from(horas)
    .innerJoin(contratos, eq(contratos.id, horas.contratoId))
    .innerJoin(clientes, eq(clientes.id, contratos.clienteId))
    .where(isNull(horas.recebivelId))
    .groupBy(contratos.id, clientes.id);
  return rows.map((r) => ({ ...r, valor: valorHoras(r.minutos, r.contrato.valorHora ?? 0) }));
}

export async function recebiveisAbertos(db: DB) {
  return db
    .select({ r: recebiveis, cliente: clientes, contrato: contratos })
    .from(recebiveis)
    .innerJoin(clientes, eq(clientes.id, recebiveis.clienteId))
    .innerJoin(contratos, eq(contratos.id, recebiveis.contratoId))
    .where(isNull(recebiveis.recebidoEm))
    .orderBy(asc(recebiveis.vencimento));
}

export interface MesClados {
  espaco: Espaco;
  mes: MonthKey;
  hoje: ISODate;
  saldo: Cents;
  comprometido: { total: Cents; contas: Cents; faturas: Cents };
  podeRetirar: Cents;
  retirado: Cents;
  metaRetirada: Cents;
  faltaNaCasa: Cents;
  fixasMes: Cents;
  necessario: Cents;
  mei: ReturnType<typeof situacaoMei>;
  atrasados: Awaited<ReturnType<typeof recebiveisAbertos>>;
  horasAbertas: HorasAbertas[];
  proximos: { mes: MonthKey; contratado: Cents; falta: Cents }[];
  das: typeof contasMes.$inferSelect | null;
}

/** `casa` permite reaproveitar o mês da Casa quando a tela já está calculando ele. */
export async function mesClados(db: DB, mes: MonthKey, hoje: ISODate, casa?: Promise<MesCasa>): Promise<MesClados> {
  const espaco = await getEspaco(db, "clados");
  await gerarAoRedor(db, espaco, mes, 3);
  // Tudo de uma vez: cada consulta vai numa conexão, então o tempo é o da mais lenta, não a soma.
  const [mc, saldo, comp, retirado, fixasMes, faturado, abertos, horasAbertas, porMes, [das]] = await Promise.all([
    casa ?? mesCasa(db, mes, hoje),
    saldoConta(db, espaco, hoje),
    comprometido(db, espaco, hoje),
    retiradoNoMes(db, espaco, mes),
    fixasClados(db, espaco, mes),
    faturadoNoAno(db, espaco, Number(mes.slice(0, 4))),
    recebiveisAbertos(db),
    horasNaoCobradas(db),
    db
      .select({
        mes: sql<string>`to_char(${recebiveis.vencimento}, 'YYYY-MM')`,
        v: sql<number>`coalesce(sum(${recebiveis.valor}),0)`.mapWith(Number),
      })
      .from(recebiveis)
      .where(and(gte(recebiveis.vencimento, firstDay(addMonths(mes, 1))), lte(recebiveis.vencimento, lastDay(addMonths(mes, 3)))))
      .groupBy(sql`1`),
    db
      .select()
      .from(contasMes)
      .where(and(eq(contasMes.espacoId, espaco.id), isNull(contasMes.pagoEm), sql`${contasMes.nome} ilike 'DAS%'`))
      .orderBy(asc(contasMes.vencimento))
      .limit(1),
  ]);
  const metaRetirada = mc.resumo.metaRetirada;
  const necessario = faturamentoNecessario(metaRetirada, fixasMes);

  const somaDe = new Map(porMes.map((r) => [r.mes, r.v]));
  const proximos = [1, 2, 3].map((i) => {
    const m = addMonths(mes, i);
    const v = somaDe.get(m) ?? 0;
    return { mes: m, contratado: v, falta: Math.max(0, necessario - v) };
  });

  return {
    espaco,
    mes,
    hoje,
    saldo,
    comprometido: comp,
    podeRetirar: podeRetirar(saldo, comp.total, espaco.reservaMinima),
    retirado,
    metaRetirada,
    faltaNaCasa: mc.resumo.faltaEntrar,
    fixasMes,
    necessario,
    mei: situacaoMei(faturado),
    atrasados: abertos.filter((a) => a.r.vencimento < hoje),
    horasAbertas,
    proximos,
    das: das ?? null,
  };
}

/** Em aberto = suportes e cobranças vencidos, parcelas de projeto a receber e horas não cobradas. */
export async function listaClientes(db: DB, hoje: ISODate) {
  const ano = Number(hoje.slice(0, 4));
  const [cls, cts, recs, hs] = await Promise.all([
    db.select().from(clientes).where(eq(clientes.ativo, true)).orderBy(asc(clientes.nome)),
    db.select().from(contratos).where(eq(contratos.ativo, true)),
    db.select().from(recebiveis),
    horasNaoCobradas(db),
  ]);
  return cls.map((c) => {
    const meus = recs.filter((r) => r.clienteId === c.id);
    const tipoDe = (r: Recebivel) => cts.find((k) => k.id === r.contratoId)?.tipo;
    const emAberto = sum(meus.filter((r) => !r.recebidoEm && (r.vencimento <= hoje || tipoDe(r) === "projeto")).map((r) => r.valor)) + sum(hs.filter((h) => h.cliente.id === c.id).map((h) => h.valor));
    const recebidoAno = sum(meus.filter((r) => r.recebidoEm && r.recebidoEm.startsWith(String(ano))).map((r) => r.valor));
    return { cliente: c, contratos: cts.filter((k) => k.clienteId === c.id), emAberto, recebidoAno, recebiveis: meus };
  });
}
