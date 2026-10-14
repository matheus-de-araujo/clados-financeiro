import Link from "next/link";
import { addMonths, monthTitle, type MonthKey } from "@/lib/dates";
import { Icone } from "./icones";
import type { TipoEspaco } from "@/server/base";

/** Alternância Clados / Casa. Some quando a pessoa só tem acesso a um espaço. */
export function Alternar({ ativo, acesso }: { ativo: TipoEspaco; acesso: Record<TipoEspaco, unknown> }) {
  if (!acesso.clados || !acesso.casa) return <div className="text-[15px] font-semibold">{ativo === "clados" ? "Clados" : "Casa"}</div>;
  const item = (tipo: TipoEspaco, label: string) => (
    <Link
      href={`/${tipo}`}
      prefetch
      className="flex h-8 items-center rounded-full px-4 text-[14px] font-semibold"
      style={ativo === tipo ? { background: "#fff", color: "var(--color-tinta)", boxShadow: "0 1px 2px rgba(10,31,26,.12)" } : { color: "var(--color-cinza)" }}
      aria-current={ativo === tipo ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex rounded-full p-[3px]" style={{ background: "var(--color-seg)" }}>
      {item("clados", "Clados")}
      {item("casa", "Casa")}
    </div>
  );
}

export function SeletorMes({ mes, base }: { mes: MonthKey; base: string }) {
  const href = (m: MonthKey) => `${base}?m=${m}`;
  return (
    <div className="flex items-center rounded-full border border-borda bg-white p-[2px]">
      <Link href={href(addMonths(mes, -1))} aria-label="Mês anterior" className="flex h-8 w-8 items-center justify-center text-cinza">
        <Icone nome="left" tam={16} />
      </Link>
      <span className="px-1 text-[14px] font-medium">{monthTitle(mes)}</span>
      <Link href={href(addMonths(mes, 1))} aria-label="Próximo mês" className="flex h-8 w-8 items-center justify-center text-cinza">
        <Icone nome="right" tam={16} />
      </Link>
    </div>
  );
}

export function Topo({ ativo, acesso, mes, nome }: { ativo: TipoEspaco; acesso: Record<TipoEspaco, unknown>; mes: MonthKey; nome: string }) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pb-2" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
      <Alternar ativo={ativo} acesso={acesso} />
      <div className="flex items-center gap-2">
        <SeletorMes mes={mes} base={`/${ativo}`} />
        <Link href="/pessoas" className="av" style={{ width: 36, height: 36 }} aria-label="Pessoas e conta">
          {nome.slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
