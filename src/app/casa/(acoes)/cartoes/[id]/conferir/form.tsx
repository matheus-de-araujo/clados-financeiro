"use client";

import Link from "next/link";
import { useState } from "react";
import { BotaoPrincipal, BotaoSecundario, Erro, Rodape, useEnviar } from "@/components/form";
import { Icone } from "@/components/icones";
import { ddmm } from "@/lib/dates";
import { brl, num } from "@/lib/money";

export function FormConferir({ cartaoId, mes, banco, lancado, ultimo, desde, recentes }: { cartaoId: number; mes: string; banco: string; lancado: number; ultimo: number | null; desde: string | null; recentes: { id: number; data: string; descricao: string; categoria: string; valor: number }[] }) {
  const [noBanco, setNoBanco] = useState(ultimo ?? 0);
  const { enviar, enviando, erro } = useEnviar();
  const dif = noBanco - lancado;
  const txt = num(noBanco);

  return (
    <>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-[10px]">
        <div className="card p-4">
          <div className="text-[13px] text-cinza">Lançado aqui</div>
          <div className="num text-[20px] font-semibold">{brl(lancado)}</div>
        </div>
        <label className="card relative block p-4" style={{ borderColor: "var(--color-mata)" }}>
          <div className="text-[13px] text-cinza">No app do {banco}</div>
          <div className="num text-[20px] font-semibold" style={{ color: noBanco ? undefined : "var(--color-cinza-2)" }}>
            R$ {txt}
          </div>
          <input
            aria-label={`Total no app do ${banco}`}
            inputMode="numeric"
            autoFocus
            value={noBanco ? String(noBanco) : ""}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 10);
              setNoBanco(d ? Number(d) : 0);
            }}
            className="absolute inset-0 h-full w-full opacity-0"
          />
        </label>
      </div>
      {noBanco ? (
        dif > 0 ? (
          <div className="aviso aviso-vermelho mx-4 mt-3" role="status">
            <span className="shrink-0 text-vermelho">
              <Icone nome="alert" tam={18} />
            </span>
            <span>
              <b>Faltam {brl(dif)} em lançamentos.</b> Abra o {banco} e procure compras {desde ? `depois de ${ddmm(desde)}, a última conferência` : "desta fatura"}.
            </span>
          </div>
        ) : dif < 0 ? (
          <div className="aviso aviso-vermelho mx-4 mt-3" role="status">
            <span>
              <b>Tem {brl(-dif)} a mais aqui do que no {banco}.</b> Pode ser uma compra lançada duas vezes ou que caiu na fatura seguinte.
            </span>
          </div>
        ) : (
          <div className="aviso mx-4 mt-3" style={{ background: "#e7f6f1" }} role="status">
            <Icone nome="check" tam={18} /> <b>Bateu certinho.</b>
          </div>
        )
      ) : (
        <p className="mx-4 mt-3 text-[13px] text-cinza">Digite o total da fatura aberta que aparece no app do {banco}.</p>
      )}
      {recentes.length ? (
        <section className="sec">
          <div className="lbl">{desde ? `Lançado depois de ${ddmm(desde)}` : "Lançado nesta fatura"}</div>
          <div className="card">
            {recentes.map((r) => (
              <div key={r.id} className="linha">
                <span className="num w-11 shrink-0 text-[13px] text-cinza">{ddmm(r.data)}</span>
                <span className="min-w-0 flex-1">
                  <span className="t1 truncate">{r.descricao}</span>
                  <span className="t2">{r.categoria}</span>
                </span>
                <span className="num text-[15px] font-semibold">{num(r.valor)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <Erro texto={erro} />
      <Rodape>
        {dif > 0 ? (
          <>
            <Link href="/casa/gastei" className="btn p-mata">
              Lançar o que faltou
            </Link>
            <BotaoSecundario
              disabled={enviando}
              onClick={() => enviar("/api/faturas/conferir", { cartaoId, mes, totalNoBanco: noBanco, lancarDiferenca: true }, { destino: `/casa/cartoes?c=${cartaoId}`, aviso: "Diferença lançada" })}
            >
              Lançar {brl(dif)} como &quot;Sem categoria&quot;
            </BotaoSecundario>
          </>
        ) : (
          <BotaoPrincipal disabled={enviando || !noBanco} onClick={() => enviar("/api/faturas/conferir", { cartaoId, mes, totalNoBanco: noBanco }, { destino: `/casa/cartoes?c=${cartaoId}`, aviso: "Fatura conferida" })}>
            Salvar conferência
          </BotaoPrincipal>
        )}
      </Rodape>
    </>
  );
}
