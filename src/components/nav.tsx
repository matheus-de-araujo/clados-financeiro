"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icone } from "./icones";

type Espaco = "clados" | "casa";

const ITENS: Record<Espaco, [string, string, string][]> = {
  clados: [
    ["/clados", "Início", "home"],
    ["/clados/clientes", "Clientes", "users"],
    ["/clados/extrato", "Extrato", "list"],
    ["/clados/cartao", "Cartão", "card"],
  ],
  casa: [
    ["/casa", "Início", "home"],
    ["/casa/contas", "Contas", "check"],
    ["/casa/cartoes", "Cartões", "card"],
    ["/casa/extrato", "Extrato", "list"],
  ],
};

const ACOES: Record<Espaco, { href: string; titulo: string; texto: string; icone: string }[]> = {
  clados: [
    { href: "/clados/recebi", titulo: "Recebi", texto: "Cliente pagou suporte, parcela ou horas", icone: "in" },
    { href: "/clados/trabalhei", titulo: "Trabalhei", texto: "Registrar horas de manutenção", icone: "clock" },
    { href: "/clados/paguei", titulo: "Paguei", texto: "Conta, ferramenta ou compra no cartão", icone: "out" },
    { href: "/clados/retirada", titulo: "Retirada", texto: "Vai para a Casa como renda", icone: "wallet" },
  ],
  casa: [
    { href: "/casa/gastei", titulo: "Gastei", texto: "Compra num dos cartões, por categoria", icone: "card" },
    { href: "/casa/fatura", titulo: "Paguei a fatura", texto: "Quita a fatura de um cartão", icone: "check" },
    { href: "/casa/entrou", titulo: "Entrou", texto: "Renda da Dayane ou outra entrada", icone: "in" },
    { href: "/casa/reserva", titulo: "Reserva", texto: "Guardar ou usar a reserva", icone: "wallet" },
  ],
};

const EXTRA: Record<Espaco, { href: string; texto: string; icone: string }> = {
  clados: { href: "/clados/clientes/novo", texto: "Novo cliente ou contrato", icone: "users" },
  casa: { href: "/casa/contas/nova", texto: "Nova conta fixa ou parcelado", icone: "plus" },
};

export function Navegacao({ espaco, podeEditar }: { espaco: Espaco; podeEditar: boolean }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [path]);
  const itens = ITENS[espaco];

  const item = ([href, label, ic]: [string, string, string]) => {
    const on = href === `/${espaco}` ? path === href : path.startsWith(href);
    return (
      <Link key={href} href={href} className="flex flex-col items-center gap-[3px] text-[11px]" style={on ? { fontWeight: 500, color: "var(--color-mata)" } : { color: "var(--color-cinza)" }} aria-current={on ? "page" : undefined}>
        <Icone nome={ic} />
        {label}
      </Link>
    );
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-[480px] -translate-x-1/2 items-center border-t border-borda bg-white px-2 pt-2"
        style={{ gridTemplateColumns: "repeat(5,minmax(0,1fr))", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}
      >
        {item(itens[0])}
        {item(itens[1])}
        {podeEditar ? (
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Novo lançamento"
            className="flex h-[52px] w-[52px] items-center justify-center justify-self-center rounded-full border-0"
            style={{ background: "var(--color-mata)", color: "var(--color-fundo)" }}
          >
            <Icone nome="plus" tam={24} traco={2} />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-[3px] text-[11px] text-cinza-2">
            <Icone nome="lock" />
            Só vê
          </div>
        )}
        {item(itens[2])}
        {item(itens[3])}
      </nav>
      {aberto ? <Folha espaco={espaco} fechar={() => setAberto(false)} /> : null}
    </>
  );
}

function Folha({ espaco, fechar }: { espaco: Espaco; fechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [fechar]);
  const acoes = ACOES[espaco];
  const extra = EXTRA[espaco];
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="O que aconteceu?">
      <button type="button" aria-label="Fechar" onClick={fechar} className="absolute inset-0 border-0" style={{ background: "rgba(15,23,20,.45)" }} />
      <div
        className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[24px] px-4 pt-3"
        style={{ background: "var(--color-fundo)", paddingBottom: "calc(24px + env(safe-area-inset-bottom))", animation: "subir .18s ease-out" }}
      >
        <div className="mx-auto mb-3 h-[5px] w-9 rounded-full" style={{ background: "#c9cec6" }} />
        <div className="flex items-start justify-between">
          <div>
            <div className="lbl" style={{ marginBottom: 2 }}>
              {espaco === "clados" ? "Clados" : "Casa"}
            </div>
            <div className="text-[20px] font-semibold tracking-[-0.4px]">O que aconteceu?</div>
          </div>
          <button type="button" onClick={fechar} className="redondo" aria-label="Fechar">
            <Icone nome="x" tam={16} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-[10px]">
          {acoes.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-[14px] border p-4"
              style={i === 0 ? { background: "var(--color-mata)", borderColor: "var(--color-mata)", color: "#fff" } : { background: "#fff", borderColor: "var(--color-borda)" }}
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-full"
                style={i === 0 ? { background: "var(--color-agua)", color: "var(--color-agua-escura)" } : { background: "var(--color-fundo)", color: "var(--color-mata)" }}
              >
                <Icone nome={a.icone} tam={20} />
              </div>
              <div className="text-[17px] font-semibold">{a.titulo}</div>
              <div className="mt-[2px] text-[13px] leading-[18px]" style={{ color: i === 0 ? "#cfe3dc" : "var(--color-cinza)" }}>
                {a.texto}
              </div>
            </Link>
          ))}
        </div>
        <Link href={extra.href} className="card mt-[10px] flex items-center gap-3 px-4 py-3">
          <Icone nome={extra.icone} />
          <span className="flex-1 text-[16px] font-medium">{extra.texto}</span>
          <Icone nome="right" tam={18} className="text-cinza" />
        </Link>
      </div>
      <style>{"@keyframes subir{from{transform:translate(-50%,40px);opacity:.4}to{transform:translate(-50%,0);opacity:1}}"}</style>
    </div>
  );
}
