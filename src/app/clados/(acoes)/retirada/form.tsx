"use client";

import { useState } from "react";
import { BotaoPrincipal, BotaoSecundario, CampoValor, Erro, Rodape, useEnviar } from "@/components/form";
import { Icone } from "@/components/icones";
import { Barra } from "@/components/ui";
import { brlShort } from "@/lib/money";

export function FormRetirada({ pode, retirado, meta, reserva, hoje }: { pode: number; retirado: number; meta: number; reserva: number; hoje: string }) {
  const falta = Math.max(0, meta - retirado);
  const inicial = Math.round(Math.min(pode, falta || pode) / 100) * 100;
  const [valor, setValor] = useState(inicial);
  const { enviar, enviando, erro } = useEnviar();
  const excesso = Math.max(0, valor - pode);
  const sobra = pode - valor;
  const atalhos = [...new Set([100_000, 200_000, pode].filter((v) => v > 0))].sort((a, b) => a - b).slice(-3);

  const retirar = (v: number) => enviar("/api/retiradas", { valor: v, data: hoje }, { destino: "/clados", aviso: `Retirada de ${brlShort(v)} feita` });

  return (
    <>
      <CampoValor valor={valor} onChange={setValor} />
      <div className="mx-4 mt-2 flex justify-center gap-2">
        {atalhos.map((v) => (
          <button key={v} type="button" className={`chip ${valor === v ? "on" : ""}`} onClick={() => setValor(v)}>
            {v === pode ? `Tudo · ${brlShort(v)}` : brlShort(v)}
          </button>
        ))}
      </div>
      {excesso > 0 ? (
        <div className="aviso aviso-vermelho mx-4 mt-4" role="alert">
          <span className="shrink-0 text-vermelho">
            <Icone nome="alert" tam={18} />
          </span>
          <span>
            <b>{brlShort(excesso)} acima do que dá para retirar.</b> Essa diferença sai da reserva da Clados, que cairia de {brlShort(reserva)} para {brlShort(Math.max(0, reserva - excesso))}.
          </span>
        </div>
      ) : null}
      <div className="card mx-4 mt-4">
        <div className="linha">
          <span className="flex-1 text-[15px]">Pode retirar agora</span>
          <span className="num text-[15px] font-semibold text-verde">{brlShort(pode)}</span>
        </div>
        <div className="linha">
          <span className="flex-1 text-[15px]">Sobra depois desta</span>
          <span className="num text-[15px] font-semibold" style={{ color: sobra < 0 ? "var(--color-vermelho)" : undefined }}>
            {brlShort(sobra)}
          </span>
        </div>
        <div className="linha block">
          <div className="flex justify-between text-[13px] text-cinza">
            <span>Casa no mês, com esta</span>
            <span className="num">
              <b className="text-tinta">{brlShort(retirado + valor)}</b> de {brlShort(meta)}
            </span>
          </div>
          <div className="mt-2">
            <Barra pct={meta ? ((retirado + valor) / meta) * 100 : 100} cor="var(--color-mata)" />
          </div>
        </div>
      </div>
      <Erro texto={erro} />
      <Rodape>
        {excesso > 0 ? (
          <>
            <BotaoPrincipal disabled={enviando || pode <= 0} onClick={() => retirar(pode)}>
              Retirar {brlShort(pode)}
            </BotaoPrincipal>
            <BotaoSecundario disabled={enviando} onClick={() => retirar(valor)}>
              Retirar {brlShort(valor)} mesmo assim
            </BotaoSecundario>
          </>
        ) : (
          <BotaoPrincipal disabled={enviando || !valor} onClick={() => retirar(valor)}>
            {enviando ? "Salvando…" : "Confirmar retirada"}
          </BotaoPrincipal>
        )}
      </Rodape>
    </>
  );
}
