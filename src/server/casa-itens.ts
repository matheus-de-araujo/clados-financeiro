import type { ItemConta } from "@/components/contas";
import { monthName, addMonths, monthYearShort, firstDay } from "@/lib/dates";
import type { ContaMes, MesCasa } from "./casa";
import { valorDaConta } from "./casa";

/** Linhas da lista de contas da Casa, com o dízimo calculado e a falta trazida do mês anterior. */
export function itensContasCasa(m: MesCasa, hoje: string): ItemConta[] {
  const itens: ItemConta[] = m.contas.map((c: ContaMes) => {
    let sub: string;
    if (c.tipo === "dizimo") sub = c.pagoEm ? "10% da retirada" : m.retiradas >= m.resumo.metaRetirada ? "10% das retiradas do mês" : `10% da retirada prevista`;
    else if (c.tipo === "reserva") sub = "Vai para a reserva";
    else if (c.parcela && c.parcelas) sub = `Parcela ${c.parcela} de ${c.parcelas} · até ${monthYearShort(addMonths(c.mes, c.parcelas - c.parcela))}`;
    else if (!c.contaFixaId) sub = "Só neste mês";
    else sub = "Todo mês";
    return {
      id: c.id,
      vencimento: c.vencimento,
      nome: c.nome,
      sub,
      valor: valorDaConta(c, m.resumo),
      pago: !!c.pagoEm,
      podeMarcar: true,
      atrasada: !c.pagoEm && c.vencimento < hoje,
    };
  });
  if (m.resumo.faltaAnterior > 0) {
    itens.unshift({
      id: null,
      vencimento: firstDay(m.mes),
      nome: `Falta de ${monthName(addMonths(m.mes, -1))}`,
      sub: "Já saiu da conta; precisa voltar este mês",
      valor: m.resumo.faltaAnterior,
      pago: false,
      podeMarcar: false,
    });
  }
  return itens;
}
