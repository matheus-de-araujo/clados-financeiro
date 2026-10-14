import { and, eq, isNull, lte, or, gte } from "drizzle-orm";
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
  if (mes < monthOf(espaco.dataInicio)) return;
  const fixas = await db
    .select()
    .from(contasFixas)
    .where(and(eq(contasFixas.espacoId, espaco.id), eq(contasFixas.ativo, true), lte(contasFixas.inicioMes, mes), or(isNull(contasFixas.fimMes), gte(contasFixas.fimMes, mes))));

  for (const f of fixas) {
    if (!fixaAtivaNoMes(f, mes)) continue;
    const parcela = parcelaNoMes(f, mes);
    const data = dateInMonth(mes, f.dia);
    if (data < espaco.dataInicio) continue;
    if (f.cartaoId) {
      const [c] = await db.select().from(cartoes).where(eq(cartoes.id, f.cartaoId));
      if (!c) continue;
      await db
        .insert(lancamentos)
        .values({
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
        })
        .onConflictDoNothing();
    } else {
      await db
        .insert(contasMes)
        .values({
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
        })
        .onConflictDoNothing();
    }
  }

  if (espaco.tipo === "clados") {
    const sups = await db
      .select({ c: contratos })
      .from(contratos)
      .innerJoin(clientes, eq(clientes.id, contratos.clienteId))
      .where(and(eq(contratos.tipo, "suporte"), eq(contratos.ativo, true), eq(clientes.ativo, true)));
    for (const { c } of sups) {
      if (!c.mensalidade || (c.inicioMes && mes < c.inicioMes)) continue;
      await db
        .insert(recebiveis)
        .values({
          contratoId: c.id,
          clienteId: c.clienteId,
          descricao: `${c.descricao} de ${mesNome(mes)}`,
          valor: c.mensalidade,
          vencimento: dateInMonth(mes, c.dia ?? 10),
          mesRef: mes,
        })
        .onConflictDoNothing();
    }
  }
}

function mesNome(mes: MonthKey): string {
  return ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(mes.slice(5)) - 1];
}

/** Garante o mês e os vizinhos (as compras recorrentes de um mês caem na fatura do seguinte). */
export async function gerarAoRedor(db: DB, espaco: Espaco, mes: MonthKey, depois = 1): Promise<void> {
  for (let i = -1; i <= depois; i++) await gerarMes(db, espaco, addMonths(mes, i));
}
