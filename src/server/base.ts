import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { cartoes, espacos, fechamentos, lancamentos } from "@/db/schema";
import { addMonths, type MonthKey } from "@/lib/dates";
import type { Cents } from "@/lib/money";

export type TipoEspaco = "clados" | "casa";
export type Espaco = typeof espacos.$inferSelect;
export type Cartao = typeof cartoes.$inferSelect;
export type Lancamento = typeof lancamentos.$inferSelect;

export class ErroDeNegocio extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Os dois espaços não mudam depois de criados; ficam guardados por banco para não consultar a cada tela. */
const espacosPorBanco = new WeakMap<object, Map<TipoEspaco, Espaco>>();

export async function getEspaco(db: DB, tipo: TipoEspaco): Promise<Espaco> {
  const guardados = espacosPorBanco.get(db) ?? new Map<TipoEspaco, Espaco>();
  const salvo = guardados.get(tipo);
  if (salvo) return salvo;
  const [e] = await db.select().from(espacos).where(eq(espacos.tipo, tipo));
  if (!e) throw new ErroDeNegocio(`Espaço ${tipo} não existe`, 500);
  guardados.set(tipo, e);
  espacosPorBanco.set(db, guardados);
  return e;
}

export async function getEspacoById(db: DB, id: number): Promise<Espaco> {
  const [e] = await db.select().from(espacos).where(eq(espacos.id, id));
  if (!e) throw new ErroDeNegocio("Espaço não encontrado", 404);
  return e;
}

/** Cartões do espaço. Com `inativos`, inclui os que saíram de uso (ex.: o cartão PJ antigo da Casa), para o histórico. */
export async function listCartoes(db: DB, espacoId: number, opts: { inativos?: boolean } = {}): Promise<Cartao[]> {
  const conds = [eq(cartoes.espacoId, espacoId)];
  if (!opts.inativos) conds.push(eq(cartoes.ativo, true));
  return db.select().from(cartoes).where(and(...conds)).orderBy(desc(cartoes.ativo), cartoes.ordem, cartoes.id);
}

export async function getCartao(db: DB, id: number): Promise<Cartao> {
  const [c] = await db.select().from(cartoes).where(eq(cartoes.id, id));
  if (!c) throw new ErroDeNegocio("Cartão não encontrado", 404);
  return c;
}

const ENTRA = ["entrada", "resgatar"];
const SAI = ["saida", "retirada", "fatura", "guardar"];

/** Saldo da conta do espaço: saldo inicial + entradas − saídas (compras no cartão só contam quando a fatura é paga). */
export async function saldoConta(db: DB, espaco: Espaco, ate?: string): Promise<Cents> {
  const conds = [eq(lancamentos.espacoId, espaco.id)];
  if (ate) conds.push(sql`${lancamentos.data} <= ${ate}`);
  const [r] = await db
    .select({
      entra: sql<number>`coalesce(sum(case when ${lancamentos.tipo} in ('entrada','resgatar') then ${lancamentos.valor} else 0 end),0)`.mapWith(Number),
      sai: sql<number>`coalesce(sum(case when ${lancamentos.tipo} in ('saida','retirada','fatura','guardar') then ${lancamentos.valor} else 0 end),0)`.mapWith(Number),
    })
    .from(lancamentos)
    .where(and(...conds));
  return espaco.saldoInicial + r.entra - r.sai;
}

/** Reserva da Casa: reserva inicial + guardado − resgatado. */
export async function saldoReserva(db: DB, espaco: Espaco, ate?: string): Promise<Cents> {
  const conds = [eq(lancamentos.espacoId, espaco.id), inArray(lancamentos.tipo, ["guardar", "resgatar"])];
  if (ate) conds.push(sql`${lancamentos.data} <= ${ate}`);
  const [r] = await db
    .select({
      v: sql<number>`coalesce(sum(case when ${lancamentos.tipo} = 'guardar' then ${lancamentos.valor} else -${lancamentos.valor} end),0)`.mapWith(Number),
    })
    .from(lancamentos)
    .where(and(...conds));
  return espaco.reservaInicial + r.v;
}

/** Efeito do lançamento na conta (+ entra, − sai, 0 compra no cartão). */
export function efeitoNaConta(l: Pick<Lancamento, "tipo" | "valor">): Cents {
  if (ENTRA.includes(l.tipo)) return l.valor;
  if (SAI.includes(l.tipo)) return -l.valor;
  return 0;
}

/** Sobra (+) ou falta (−) que o fechamento do mês anterior trouxe. */
export async function anteriorDoMes(db: DB, espacoId: number, mes: MonthKey): Promise<Cents> {
  const [f] = await db
    .select()
    .from(fechamentos)
    .where(and(eq(fechamentos.espacoId, espacoId), eq(fechamentos.mes, addMonths(mes, -1))));
  return f?.carrega ?? 0;
}

export async function getFechamento(db: DB, espacoId: number, mes: MonthKey) {
  const [f] = await db.select().from(fechamentos).where(and(eq(fechamentos.espacoId, espacoId), eq(fechamentos.mes, mes)));
  return f ?? null;
}
