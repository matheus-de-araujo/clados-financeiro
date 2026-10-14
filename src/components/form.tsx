"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { num, type Cents } from "@/lib/money";
import { Icone } from "./icones";

/** Envia JSON para a API. Em caso de sucesso, mostra o aviso e vai para `destino`. */
export function useEnviar() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviar = useCallback(
    async (url: string, corpo: unknown, opts: { destino?: string; aviso?: string; metodo?: string } = {}) => {
      setEnviando(true);
      setErro(null);
      try {
        const r = await fetch(url, { method: opts.metodo ?? "POST", headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErro(j.erro ?? "Não deu certo. Tente de novo.");
          return null;
        }
        if (opts.aviso) avisar(opts.aviso);
        if (opts.destino) router.push(opts.destino);
        router.refresh();
        return j;
      } catch {
        setErro("Sem conexão. Tente de novo.");
        return null;
      } finally {
        setEnviando(false);
      }
    },
    [router],
  );
  return { enviar, enviando, erro, setErro };
}

export function avisar(texto: string) {
  try {
    sessionStorage.setItem("aviso", texto);
  } catch {}
  window.dispatchEvent(new Event("aviso"));
}

/** Aviso rápido no topo depois de salvar. */
export function Aviso() {
  const path = usePathname();
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    const ler = () => {
      let t: string | null = null;
      try {
        t = sessionStorage.getItem("aviso");
        sessionStorage.removeItem("aviso");
      } catch {}
      if (t) {
        setTexto(t);
        setTimeout(() => setTexto(null), 2200);
      }
    };
    ler();
    window.addEventListener("aviso", ler);
    return () => window.removeEventListener("aviso", ler);
  }, [path]);
  if (!texto) return null;
  return (
    <div className="toast" role="status">
      <span className="mr-1 inline-flex align-[-4px]">
        <Icone nome="check" tam={18} traco={2.2} />
      </span>
      {texto}
    </div>
  );
}

export function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div className="aviso aviso-vermelho mx-4 mt-4" role="alert">
      <span className="shrink-0 text-vermelho">
        <Icone nome="alert" tam={18} />
      </span>
      <span>{texto}</span>
    </div>
  );
}

/** Valor grande, digitado como no app do banco: os números entram pela direita (8990 → 89,90). */
export function CampoValor({ valor, onChange, rotulo = "Valor", autoFocus = true }: { valor: Cents; onChange: (v: Cents) => void; rotulo?: string; autoFocus?: boolean }) {
  const txt = num(valor);
  const i = txt.lastIndexOf(",");
  return (
    <label className="relative mt-4 block text-center">
      <div className="text-[13px] text-cinza">{rotulo}</div>
      <div className="num mt-1 text-[48px] leading-[56px] font-medium tracking-[-1.5px]" style={{ color: valor ? undefined : "var(--color-cinza-2)" }}>
        R$ {txt.slice(0, i)}
        <span className="text-[24px] tracking-normal text-cinza">{txt.slice(i)}</span>
      </div>
      <input
        aria-label={rotulo}
        inputMode="numeric"
        autoFocus={autoFocus}
        value={valor ? String(valor) : ""}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").slice(0, 10);
          onChange(d ? Number(d) : 0);
        }}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </label>
  );
}

export function Chips<T extends string | number | null>({ opcoes, valor, onChange, rotulo }: { opcoes: { valor: T; texto: string }[]; valor: T; onChange: (v: T) => void; rotulo?: string }) {
  return (
    <div className="mx-4 mt-4">
      {rotulo ? <div className="mb-[6px] text-[13px] text-cinza">{rotulo}</div> : null}
      <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap">
        {opcoes.map((o) => (
          <button key={String(o.valor)} type="button" role="radio" aria-checked={o.valor === valor} className={`chip ${o.valor === valor ? "on" : ""}`} onClick={() => onChange(o.valor)}>
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Interruptor({ ligado, onChange, titulo, texto }: { ligado: boolean; onChange: (v: boolean) => void; titulo: string; texto?: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)} className="field mx-4 mt-3 flex w-[calc(100%-32px)] items-center gap-3 text-left">
      <span className="flex-1">
        <span className="t1">{titulo}</span>
        {texto ? <span className="t2">{texto}</span> : null}
      </span>
      <span className="relative h-7 w-[46px] shrink-0 rounded-full transition-colors" style={{ background: ligado ? "var(--color-mata)" : "#d1d5db" }}>
        <i className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all" style={{ left: ligado ? 21 : 3 }} />
      </span>
    </button>
  );
}

export function Campo({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`field mx-4 mt-3 ${className}`}>
      <div className="flbl">{rotulo}</div>
      {children}
    </label>
  );
}

export function Contador({ rotulo, valor, onChange, min = 1, max = 48, formatar }: { rotulo: string; valor: number; onChange: (n: number) => void; min?: number; max?: number; formatar: (n: number) => string }) {
  return (
    <div className="field mx-4 mt-3 flex items-center gap-3">
      <div className="flex-1">
        <div className="flbl">{rotulo}</div>
        <div className="text-[17px] font-medium">{formatar(valor)}</div>
      </div>
      <button type="button" className="redondo" aria-label="Menos" onClick={() => onChange(Math.max(min, valor - 1))} disabled={valor <= min}>
        <Icone nome="minus" tam={18} />
      </button>
      <button type="button" className="redondo" aria-label="Mais" onClick={() => onChange(Math.min(max, valor + 1))} disabled={valor >= max}>
        <Icone nome="plus" tam={18} />
      </button>
    </div>
  );
}

export function Rodape({ children }: { children: ReactNode }) {
  return <div className="rodape">{children}</div>;
}

export function BotaoPrincipal({ children, disabled, onClick, type = "button" }: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} className="btn p-mata" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function BotaoSecundario({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="btn p-linha mt-[10px]" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
