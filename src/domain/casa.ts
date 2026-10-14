import type { Cents } from "@/lib/money";
import { pct, sum } from "@/lib/money";

export type TipoConta = "normal" | "dizimo" | "reserva";

export interface ContaDoMes {
  valor: Cents; // valor previsto (para o dízimo, ignorado enquanto não pago)
  tipo: TipoConta;
  pago: boolean;
  valorPago?: Cents | null;
  percentual?: number | null; // pontos-base, só para o dízimo
}

export interface EntradaResumoCasa {
  contas: ContaDoMes[];
  faturas: Cents[]; // total de cada fatura que vence no mês
  gastosAvulsos: Cents; // débito, Pix e saídas que não são conta nem fatura
  retiradas: Cents; // retiradas da Clados que entraram no mês
  outrasEntradas: Cents; // renda da Dayane e outras
  anterior: Cents; // sobra (+) deixada na conta ou falta (−) levada do mês anterior
}

export interface ResumoCasa {
  contas: Cents;
  dizimo: Cents;
  dizimoPago: boolean;
  faturas: Cents;
  gastosAvulsos: Cents;
  faltaAnterior: Cents;
  sobraAnterior: Cents;
  precisa: Cents;
  precisaSemDizimo: Cents;
  entrou: Cents;
  faltaEntrar: Cents;
  metaRetirada: Cents;
  faltaRetirar: Cents;
  resultado: Cents;
}

export const DIZIMO_PADRAO = 1000; // 10%

/**
 * Resumo do mês da Casa.
 * Precisa = contas + faturas que vencem no mês + gastos avulsos + falta trazida.
 * Entrou = retiradas + outras entradas (+ sobra deixada na conta no mês anterior).
 * Meta de retirada = (precisa sem dízimo − outras entradas) ÷ 0,9, para o dízimo da própria retirada caber.
 * Dízimo previsto = 10% do maior entre o que já foi retirado e a meta; depois de pago, vale o valor pago.
 */
export function resumoCasa(e: EntradaResumoCasa): ResumoCasa {
  const contasNormais = e.contas.filter((c) => c.tipo !== "dizimo");
  const dizimos = e.contas.filter((c) => c.tipo === "dizimo");
  const valorConta = (c: ContaDoMes) => (c.pago && c.valorPago != null ? c.valorPago : c.valor);

  const contas = sum(contasNormais.map(valorConta));
  const faturas = sum(e.faturas);
  const faltaAnterior = Math.max(0, -e.anterior);
  const sobraAnterior = Math.max(0, e.anterior);
  const precisaSemDizimo = contas + faturas + e.gastosAvulsos + faltaAnterior;
  const outras = e.outrasEntradas + sobraAnterior;

  const dizimoPagoValor = sum(dizimos.filter((c) => c.pago).map(valorConta));
  const dizimoAberto = dizimos.filter((c) => !c.pago);
  const percentual = dizimoAberto[0]?.percentual ?? DIZIMO_PADRAO;
  const dizimoPago = dizimos.length > 0 && dizimoAberto.length === 0;

  let metaRetirada: Cents;
  let dizimoPrevisto = 0;
  if (dizimoAberto.length === 0) {
    metaRetirada = Math.max(0, precisaSemDizimo + dizimoPagoValor - outras);
  } else {
    const fator = 1 - percentual / 10_000;
    metaRetirada = Math.max(0, Math.round((precisaSemDizimo + dizimoPagoValor - outras) / fator));
    dizimoPrevisto = pct(Math.max(e.retiradas, metaRetirada), percentual) - dizimoPagoValor;
    dizimoPrevisto = Math.max(0, dizimoPrevisto);
  }
  const dizimo = dizimoPagoValor + dizimoPrevisto;

  const precisa = precisaSemDizimo + dizimo;
  const entrou = e.retiradas + e.outrasEntradas + sobraAnterior;
  return {
    contas,
    dizimo,
    dizimoPago,
    faturas,
    gastosAvulsos: e.gastosAvulsos,
    faltaAnterior,
    sobraAnterior,
    precisa,
    precisaSemDizimo,
    entrou,
    faltaEntrar: Math.max(0, precisa - entrou),
    metaRetirada,
    faltaRetirar: Math.max(0, metaRetirada - e.retiradas),
    resultado: entrou - precisa,
  };
}

/** Valor sugerido ao marcar o dízimo como pago: 10% do que entrou de retirada no mês. */
export function dizimoSugerido(retiradas: Cents, percentual = DIZIMO_PADRAO): Cents {
  return pct(retiradas, percentual);
}

export type DecisaoFechamento = "reserva" | "conta" | "resgatar" | "proximo";

/** Opções válidas para o fechamento conforme o resultado. */
export function opcoesFechamento(resultado: Cents): DecisaoFechamento[] {
  if (resultado > 0) return ["reserva", "conta"];
  if (resultado < 0) return ["resgatar", "proximo"];
  return ["conta"];
}

/** O que passa para o mês seguinte: sobra deixada na conta (+) ou falta levada (−). */
export function carregaParaProximo(resultado: Cents, decisao: DecisaoFechamento): Cents {
  if (decisao === "conta" || decisao === "proximo") return resultado;
  return 0;
}
