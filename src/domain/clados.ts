import type { Cents } from "@/lib/money";

export const LIMITE_MEI: Cents = 81_000_00;

/** Pode retirar = saldo − comprometido − reserva mínima. Nunca negativo. */
export function podeRetirar(saldo: Cents, comprometido: Cents, reservaMinima: Cents): Cents {
  return Math.max(0, saldo - comprometido - reservaMinima);
}

/** Quanto uma retirada passa do que dá para tirar (0 se não passa). */
export function excessoRetirada(valor: Cents, pode: Cents): Cents {
  return Math.max(0, valor - pode);
}

/** Faturamento necessário por mês = meta de retirada da Casa + contas fixas da Clados. */
export function faturamentoNecessario(metaRetirada: Cents, contasFixasClados: Cents): Cents {
  return metaRetirada + contasFixasClados;
}

export interface SituacaoMei {
  faturado: Cents;
  limite: Cents;
  percentual: number; // 0–100+
  alerta: boolean; // passou de 80%
}

export function situacaoMei(faturadoNoAno: Cents, limite = LIMITE_MEI): SituacaoMei {
  const percentual = (faturadoNoAno / limite) * 100;
  return { faturado: faturadoNoAno, limite, percentual, alerta: percentual >= 80 };
}

/** Valor das horas em centavos, arredondado para o centavo. */
export function valorHoras(minutos: number, valorHora: Cents): Cents {
  return Math.round((minutos * valorHora) / 60);
}

export function formatHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h`;
}
