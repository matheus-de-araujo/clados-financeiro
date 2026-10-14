"use client";

import { useState } from "react";
import { longDay, ddmm } from "@/lib/dates";
import { brl, signed } from "@/lib/money";
import { useEnviar } from "./form";
import { Icone } from "./icones";

export interface ItemExtrato {
  id: number;
  data: string;
  titulo: string;
  sub: string;
  valor: number; // com sinal: + entra, − sai
  cartao: boolean; // compra no cartão (não mexe na conta até pagar a fatura)
  excluivel: boolean;
  aviso?: string;
}

export function ListaExtrato({ itens, hoje, edita }: { itens: ItemExtrato[]; hoje: string; edita: boolean }) {
  const [aberto, setAberto] = useState<ItemExtrato | null>(null);
  const dias = [...new Set(itens.map((i) => i.data))];
  return (
    <>
      {dias.map((d) => (
        <section key={d} className="mx-4 mt-4">
          <div className="mb-2 px-1 text-[13px] text-cinza">{d === hoje ? `Hoje, ${longDay(d)}` : longDay(d)}</div>
          <div className="card">
            {itens
              .filter((i) => i.data === d)
              .map((i) => (
                <button key={i.id} type="button" className="linha w-full text-left" onClick={() => setAberto(i)}>
                  <span className="num w-11 shrink-0 text-[13px] text-cinza">{ddmm(i.data)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="t1 truncate">{i.titulo}</span>
                    <span className="t2">{i.sub}</span>
                  </span>
                  <span className="num shrink-0 text-[15px] font-semibold" style={{ color: i.valor > 0 ? "var(--color-verde)" : undefined }}>
                    {signed(i.valor)}
                  </span>
                </button>
              ))}
          </div>
        </section>
      ))}
      {aberto ? <Detalhe item={aberto} edita={edita} fechar={() => setAberto(null)} /> : null}
    </>
  );
}

function Detalhe({ item, edita, fechar }: { item: ItemExtrato; edita: boolean; fechar: () => void }) {
  const { enviar, enviando, erro } = useEnviar();
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={item.titulo}>
      <button type="button" aria-label="Fechar" onClick={fechar} className="absolute inset-0 border-0" style={{ background: "rgba(15,23,20,.45)" }} />
      <div className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[24px] px-4 pt-4" style={{ background: "var(--color-fundo)", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] text-cinza">{longDay(item.data)}</div>
            <div className="text-[20px] font-semibold tracking-[-0.4px]">{item.titulo}</div>
            <div className="text-[14px] text-cinza">{item.sub}</div>
          </div>
          <button type="button" onClick={fechar} className="redondo" aria-label="Fechar">
            <Icone nome="x" tam={16} />
          </button>
        </div>
        <div className="num mt-4 text-[32px] font-medium tracking-[-1px]" style={{ color: item.valor > 0 ? "var(--color-verde)" : undefined }}>
          {item.valor > 0 ? "+" : ""}
          {brl(item.valor)}
        </div>
        {item.cartao ? <p className="mt-2 text-[13px] text-cinza">Compra no cartão: sai da conta quando a fatura for paga.</p> : null}
        {item.aviso ? <p className="mt-2 text-[13px] text-cinza">{item.aviso}</p> : null}
        {erro ? (
          <div className="aviso aviso-vermelho mt-3" role="alert">
            {erro}
          </div>
        ) : null}
        {edita && item.excluivel ? (
          <button
            type="button"
            className="btn p-linha mt-5"
            style={{ color: "var(--color-vermelho)" }}
            disabled={enviando}
            onClick={async () => {
              if (!window.confirm("Excluir este lançamento?")) return;
              const ok = await enviar("/api/lancamentos/excluir", { id: item.id }, { aviso: "Lançamento excluído" });
              if (ok) fechar();
            }}
          >
            <Icone nome="trash" tam={18} /> Excluir lançamento
          </button>
        ) : null}
      </div>
    </div>
  );
}
