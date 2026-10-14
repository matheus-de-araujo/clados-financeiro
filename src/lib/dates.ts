// Datas são strings "AAAA-MM-DD" e meses são "AAAA-MM", sempre no fuso de São Paulo.

export type ISODate = string;
export type MonthKey = string;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayISO(now: Date = new Date()): ISODate {
  const fake = process.env.APP_TODAY;
  if (fake) return fake;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

export function parts(d: ISODate): { y: number; m: number; d: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, d: day };
}

export function monthOf(d: ISODate): MonthKey {
  return d.slice(0, 7);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(mk: MonthKey, n: number): MonthKey {
  const [y, m] = mk.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function monthDiff(from: MonthKey, to: MonthKey): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Dia `day` do mês; se o mês for mais curto, cai no último dia (ex.: 31 em fevereiro vira 28). */
export function dateInMonth(mk: MonthKey, day: number): ISODate {
  const [y, m] = mk.split("-").map(Number);
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export function firstDay(mk: MonthKey): ISODate {
  return `${mk}-01`;
}

export function lastDay(mk: MonthKey): ISODate {
  const [y, m] = mk.split("-").map(Number);
  return `${mk}-${pad(daysInMonth(y, m))}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const { y, m, d: day } = parts(d);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

export function monthName(mk: MonthKey): string {
  return MESES[Number(mk.slice(5, 7)) - 1];
}

export function monthTitle(mk: MonthKey): string {
  const n = monthName(mk);
  return n[0].toUpperCase() + n.slice(1);
}

export function monthShort(mk: MonthKey): string {
  return MESES_CURTOS[Number(mk.slice(5, 7)) - 1];
}

/** "14/10" */
export function ddmm(d: ISODate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/** "14 de outubro" */
export function longDay(d: ISODate): string {
  return `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1]}`;
}

/** "out/2027" */
export function monthYearShort(mk: MonthKey): string {
  return `${monthShort(mk)}/${mk.slice(0, 4)}`;
}

export function isMonthKey(s: string | undefined | null): s is MonthKey {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
