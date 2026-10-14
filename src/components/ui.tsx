import Link from "next/link";
import type { ReactNode } from "react";
import { bigParts, type Cents } from "@/lib/money";
import { monthShort, type ISODate } from "@/lib/dates";
import { Icone } from "./icones";

export function Secao({ titulo, children, className = "" }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`sec ${className}`}>
      {titulo ? <div className="lbl">{titulo}</div> : null}
      {children}
    </section>
  );
}

export function Grande({ valor, tam = 44, cor }: { valor: Cents; tam?: number; cor?: string }) {
  const p = bigParts(valor);
  return (
    <div className="num" style={{ fontSize: tam, lineHeight: `${Math.round(tam * 1.18)}px`, fontWeight: 500, letterSpacing: tam > 30 ? -1.5 : -0.5, color: cor }}>
      {p.int}
      <span style={{ fontSize: Math.round(tam / 2), color: cor ?? "var(--color-cinza)", letterSpacing: 0 }}>{p.dec}</span>
    </div>
  );
}

export function Cabecalho({ titulo, sub, voltar, direita }: { titulo: string; sub?: ReactNode; voltar: string; direita?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 px-4 pt-4" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
      <Link href={voltar} className="redondo" aria-label="Voltar">
        <Icone nome="left" tam={18} />
      </Link>
      <div className="ml-1 min-w-0 flex-1">
        <h1 className="m-0 text-[20px] font-semibold tracking-[-0.4px]">{titulo}</h1>
        {sub ? <div className="text-[13px] text-cinza">{sub}</div> : null}
      </div>
      {direita}
    </header>
  );
}

export function TituloPagina({ titulo, sub, direita }: { titulo: string; sub?: ReactNode; direita?: ReactNode }) {
  return (
    <header className="px-4" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-[28px] font-semibold tracking-[-0.6px]">{titulo}</h1>
        {direita}
      </div>
      {sub ? <div className="mt-1 text-[14px] text-cinza">{sub}</div> : null}
    </header>
  );
}

export function CaixaData({ data, alerta = false }: { data: ISODate; alerta?: boolean }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[10px]"
      style={{ background: alerta ? "var(--color-vermelho-fundo)" : "var(--color-fundo)", color: alerta ? "var(--color-vermelho)" : undefined }}
    >
      <span className="num text-[16px] leading-[18px] font-semibold">{Number(data.slice(8, 10))}</span>
      <span className="text-[11px]" style={{ color: alerta ? undefined : "var(--color-cinza)" }}>
        {monthShort(data.slice(0, 7))}
      </span>
    </div>
  );
}

export function DiaMes({ data, apagado = false }: { data: ISODate; apagado?: boolean }) {
  return (
    <div className="w-8 shrink-0 text-center" style={{ opacity: apagado ? 0.6 : 1 }}>
      <div className="num text-[17px] leading-5 font-semibold">{Number(data.slice(8, 10))}</div>
      <div className="text-[11px] text-cinza">{monthShort(data.slice(0, 7))}</div>
    </div>
  );
}

export function Barra({ pct, cor }: { pct: number; cor?: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} />
    </div>
  );
}

export function Avatar({ texto, cor, tam = 40 }: { texto: string; cor?: string; tam?: number }) {
  return (
    <div className="av" style={{ background: cor, width: tam, height: tam, fontSize: tam > 50 ? 20 : 14, color: cor === "var(--color-agua)" ? "var(--color-agua-escura)" : cor === "var(--color-trilho)" ? "var(--color-mata)" : undefined }}>
      {texto}
    </div>
  );
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? p[0]?.[1] ?? "")).toUpperCase();
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="card px-4 py-6 text-center">
      <div className="text-[16px] font-semibold">{titulo}</div>
      {texto ? <div className="mt-1 text-[14px] text-cinza">{texto}</div> : null}
      {acao ? <div className="mt-4 flex justify-center">{acao}</div> : null}
    </div>
  );
}

export function LinhaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="linha">
      {children}
      <Icone nome="right" tam={18} className="shrink-0 text-cinza" />
    </Link>
  );
}
