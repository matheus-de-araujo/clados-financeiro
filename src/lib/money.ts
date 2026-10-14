// Todo valor de dinheiro do app é um inteiro em centavos.

export type Cents = number;

const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "1.234,56" sem o símbolo. */
export function num(c: Cents): string {
  return nf2.format(c / 100);
}

/** "R$ 1.234,56" ou "−R$ 1.234,56". */
export function brl(c: Cents): string {
  return (c < 0 ? "−R$ " : "R$ ") + nf2.format(Math.abs(c) / 100);
}

/** "R$ 1.235": arredondado, para resumos. Mostra centavos só quando o valor é pequeno. */
export function brlShort(c: Cents): string {
  const abs = Math.abs(c);
  const txt = abs < 100_00 && abs % 100 !== 0 ? nf2.format(abs / 100) : nf0.format(Math.round(abs / 100));
  return (c < 0 ? "−R$ " : "R$ ") + txt;
}

/** "+1.500" / "−258,56" para listas de extrato. */
export function signed(c: Cents): string {
  const abs = Math.abs(c);
  const txt = abs % 100 === 0 ? nf0.format(abs / 100) : nf2.format(abs / 100);
  return (c > 0 ? "+" : c < 0 ? "−" : "") + txt;
}

/** Separa para o número grande: { int: "R$ 6.200", dec: ",00" }. */
export function bigParts(c: Cents): { int: string; dec: string } {
  const s = brl(c);
  const i = s.lastIndexOf(",");
  return { int: s.slice(0, i), dec: s.slice(i) };
}

/** Aceita "1.234,56", "1234,5", "1234.56" ou "1234". */
export function parseBRL(input: string): Cents | null {
  const s = input.replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  let norm: string;
  if (s.includes(",")) norm = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, "");
  else norm = s;
  const n = Number(norm);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}

/** Percentual em pontos-base (1000 = 10%), arredondado para o centavo. */
export function pct(c: Cents, basisPoints: number): Cents {
  return Math.round((c * basisPoints) / 10_000);
}
