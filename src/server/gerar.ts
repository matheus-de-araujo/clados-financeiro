import { and, eq, isNull, lte, or, gte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { cartoes, contasFixas, contasMes, contratos, clientes, lancamentos, recebiveis } from "@/db/schema";
import { mesDaFatura } from "@/domain/cartao";
import { addMonths, dateInMonth, monthDiff, monthOf, type MonthKey } from "@/lib/dates";
import type { Espaco } from "./base";

type ContaFixa = typeof contasFixas.$inferSelect;

/** Número da parcela de uma conta fixa parcelada no mês, ou null se não é parcelada. */
export function parcelaNoMes(f: Pick<ContaFixa, "parcelaInicio" | "parcelasTotal" | "inicioMes">, mes: MonthKey): number | null {
  if (!f.parcelasTotal) return null;
  return (f.parcelaInicio ?? 1) + monthDiff(f.inicioMes, mes);
}

/** A conta fixa existe nesse mês? */
export function fixaAtivaNoMes(f: ContaFixa, mes: MonthKey): boolean {
  if (!f.ativo) return false;
  if (mes < f.inicioMes) return false;
  if (f.fimMes && mes > f.fimMes) return false;
  const p = parcelaNoMes(f, mes);
  if (p !== null && (p < 1 || p > (f.parcelasTotal ?? 0))) return false;
  return true;
}

/**
 * Gera o que é previsível de um mês: as contas do mês a partir das contas fixas, as compras
 * recorrentes no cartão e, na Clados, as mensalidades de suporte. É idempotente.
 */
export async function gerarMes(db: DB, espaco: Espaco, mes: MonthKey): Promise<void> {
  await gerarMeses(db, espaco, [mes]);
}

/**
 * Meses já gerados neste servidor, por banco, com a "assinatura" das contas fixas e contratos ativos
 * daquele momento. Fica por banco porque os testes e a demonstração criam bancos novos do zero.
 */
const g = globalThis as unknown as { __mesesGerados?: WeakMap<object, Map<string, string>> };
const porBanco = (g.__mesesGerados ??= new WeakMap());
function geradosDe(db: DB) {
  let m = porBanco.get(db);
  if (!m) porBanco.set(db, (m = new Map()));
  return m;
}

/**
 * Gera vários meses de uma vez, com poucas consultas: lê as contas fixas, os cartões e os contratos
 * uma vez só e grava tudo em um insert por tabela. Meses já gerados neste servidor e sem conta fixa
 * ou contrato novo desde então são pulados (uma consulta só para conferir).
 */
export async function gerarMeses(db: DB, espaco: Espaco, meses: MonthKey[]): Promise<void> {
  const validos = meses.filter((m) => m >= monthOf(espaco.dataInicio));
  if (!validos.length) return;

  const [assin] = await db
    .select({
      f: sql<string>`(select count(*) || ':' || coalesce(max(${contasFixas.id}), 0) from ${contasFixas} where ${contasFixas.espacoId} = ${espaco.id} and ${contasFixas.ativo})`,
      c: sql<string>`(select count(*) || ':' || coalesce(max(${contratos.id}), 0) from ${contratos} where ${contratos.ativo})`,
    })
    .from(sql`(select 1) as um`);
  const assinatura = `${espaco.dataInicio}|${assin.f}|${espaco.tipo === "clados" ? assin.c : ""}`;
  const gerados = geradosDe(db);
  const faltam = validos.filter((m) => gerados.get(`${espaco.id}:${m}`) !== assinatura);
  if (!faltam.length) return;

  const menor = faltam.reduce((a, b) => (a < b ? a : b));
  const maior = faltam.reduce((a, b) => (a > b ? a : b));
  const [fixas, cards, sups] = await Promise.all([
    db
      .select()
      .from(contasFixas)
      .where(and(eq(contasFixas.espacoId, espaco.id), eq(contasFixas.ativo, true), lte(contasFixas.inicioMes, maior), or(isNull(contasFixas.fimMes), gte(contasFixas.fimMes, menor)))),
    db.select().from(cartoes).where(eq(cartoes.espacoId, espaco.id)),
    espaco.tipo === "clados"
      ? db
          .select({ c: contratos })
          .from(contratos)
          .innerJoin(clientes, eq(clientes.id, contratos.clienteId))
          .where(and(eq(contratos.tipo, "suporte"), eq(contratos.ativo, true), eq(clientes.ativo, true)))
      : Promise.resolve([] as { c: typeof contratos.$inferSelect }[]),
  ]);
  const cartaoPorId = new Map(cards.map((c) => [c.id, c]));

  const compras: (typeof lancamentos.$inferInsert)[] = [];
  const contas: (typeof contasMes.$inferInsert)[] = [];
  const mensalidades: (typeof recebiveis.$inferInsert)[] = [];

  for (const mes of faltam) {
    for (const f of fixas) {
      if (!fixaAtivaNoMes(f, mes)) continue;
      const parcela = parcelaNoMes(f, mes);
      const data = dateInMonth(mes, f.dia);
      if (data < espaco.dataInicio) continue;
      if (f.cartaoId) {
        const c = cartaoPorId.get(f.cartaoId);
        if (!c) continue;
        compras.push({
          espacoId: espaco.id,
          tipo: "compra",
          valor: f.valor,
          data,
          descricao: f.nome,
          categoriaId: f.categoriaId,
          cartaoId: c.id,
          mesFatura: mesDaFatura(data, c.diaFecha, c.diaVence),
          parcela,
          parcelas: f.parcelasTotal,
          origem: "fixa",
          contaFixaId: f.id,
          mesRef: mes,
        });
      } else {
        contas.push({
          espacoId: espaco.id,
          contaFixaId: f.id,
          mes,
          nome: f.nome,
          vencimento: data,
          valor: f.valor,
          tipo: f.tipo,
          percentual: f.percentual,
          forma: f.forma,
          parcela,
          parcelas: f.parcelasTotal,
        });
      }
    }
    for (const { c } of sups) {
      if (!c.mensalidade || (c.inicioMes && mes < c.inicioMes)) continue;
      mensalidades.push({
        contratoId: c.id,
        clienteId: c.clienteId,
        descricao: `${c.descricao} de ${mesNome(mes)}`,
        valor: c.mensalidade,
        vencimento: dateInMonth(mes, c.dia ?? 10),
        mesRef: mes,
      });
    }
  }

  await Promise.all([
    compras.length ? db.insert(lancamentos).values(compras).onConflictDoNothing() : null,
    contas.length ? db.insert(contasMes).values(contas).onConflictDoNothing() : null,
    mensalidades.length ? db.insert(recebiveis).values(mensalidades).onConflictDoNothing() : null,
  ]);
  for (const m of faltam) gerados.set(`${espaco.id}:${m}`, assinatura);
}

function mesNome(mes: MonthKey): string {
  return ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(mes.slice(5)) - 1];
}

/** Garante o mês e os vizinhos (as compras recorrentes de um mês caem na fatura do seguinte). */
export async function gerarAoRedor(db: DB, espaco: Espaco, mes: MonthKey, depois = 1): Promise<void> {
  const meses: MonthKey[] = [];
  for (let i = -1; i <= depois; i++) meses.push(addMonths(mes, i));
  await gerarMeses(db, espaco, meses);
}
