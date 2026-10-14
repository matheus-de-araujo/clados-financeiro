"use client";

import { useState } from "react";
import { BotaoPrincipal, BotaoSecundario, Erro, Rodape, useEnviar } from "@/components/form";
import { Icone } from "@/components/icones";
import { Grande } from "@/components/ui";
import { brl } from "@/lib/money";

type Decisao = "reserva" | "conta" | "resgatar" | "proximo";

export function FormFechamento(p: {
  mes: string;
  nomeMes: string;
  proximoMes: string;
  resultado: number;
  resultadoDoMes: number;
  linhas: { texto: string; valor: number }[];
  reserva: number;
  fechamento: { decisao: string; resultado: number } | null;
  podeReabrir: boolean;
  anteriorFechado: boolean;
  abertas: number;
  mesFuturo: boolean;
}) {
  const sobra = p.resultado >= 0;
  const opcoes: { v: Decisao; titulo: string; texto: string; desabilitado?: boolean }[] = sobra
    ? [
        { v: "reserva", titulo: "Mandar para a reserva", texto: `Reserva vai de ${brl(p.reserva)} para ${brl(p.reserva + p.resultado)}` },
        { v: "conta", titulo: "Deixar na conta", texto: `Entra como saldo em ${p.proximoMes}` },
      ]
    : [
        { v: "resgatar", titulo: "Cobrir com a reserva", texto: p.reserva >= -p.resultado ? `Reserva vai de ${brl(p.reserva)} para ${brl(p.reserva + p.resultado)}` : `A reserva tem só ${brl(p.reserva)}`, desabilitado: p.reserva < -p.resultado },
        { v: "proximo", titulo: `Levar para ${p.proximoMes}`, texto: `Vira a primeira conta de ${p.proximoMes}` },
      ];
  const [dec, setDec] = useState<Decisao>(opcoes.find((o) => !o.desabilitado)!.v);
  const { enviar, enviando, erro } = useEnviar();
  const nomes: Record<string, string> = { reserva: "A sobra foi para a reserva.", conta: `A sobra ficou na conta e entrou em ${p.proximoMes}.`, resgatar: "A falta foi coberta pela reserva.", proximo: `A falta foi levada para ${p.proximoMes}.` };

  return (
    <>
      <section className="px-4 pt-5">
        <div className="text-[13px] text-cinza">Resultado de {p.nomeMes}</div>
        <Grande valor={p.fechamento ? p.fechamento.resultado : p.resultado} cor={(p.fechamento?.resultado ?? p.resultado) >= 0 ? "var(--color-verde)" : "var(--color-vermelho)"} />
        {p.resultadoDoMes !== p.resultado ? <div className="text-[13px] text-cinza">Só {p.nomeMes}, sem o mês anterior: {brl(p.resultadoDoMes)}</div> : null}
      </section>
      <div className="card mx-4 mt-4">
        {p.linhas.map((l) => (
          <div key={l.texto} className="linha">
            <span className="flex-1 text-[15px]">{l.texto}</span>
            <span className="num text-[15px] font-semibold">{brl(l.valor)}</span>
          </div>
        ))}
      </div>

      {p.fechamento ? (
        <>
          <div className="aviso mx-4 mt-4" style={{ background: "#e7f6f1" }}>
            <Icone nome="check" tam={18} /> {nomes[p.fechamento.decisao]}
          </div>
          <Erro texto={erro} />
          {p.podeReabrir ? (
            <Rodape>
              <BotaoSecundario disabled={enviando} onClick={() => window.confirm(`Reabrir ${p.nomeMes}? O movimento de reserva do fechamento é desfeito.`) && enviar("/api/fechamentos/reabrir", { mes: p.mes }, { aviso: `${p.nomeMes} reaberto` })}>
                Reabrir {p.nomeMes}
              </BotaoSecundario>
            </Rodape>
          ) : null}
        </>
      ) : (
        <>
          {p.abertas > 0 ? (
            <div className="aviso aviso-vermelho mx-4 mt-4">
              <span className="shrink-0 text-vermelho">
                <Icone nome="alert" tam={18} />
              </span>
              <span>
                {p.abertas} {p.abertas === 1 ? "conta ou fatura ainda não está marcada" : "contas ou faturas ainda não estão marcadas"} como paga. O resultado usa o valor previsto.
              </span>
            </div>
          ) : null}
          {!p.anteriorFechado ? <div className="aviso aviso-vermelho mx-4 mt-4">Feche o mês anterior primeiro.</div> : null}
          <section className="sec">
            <div className="lbl">{sobra ? "O que fazer com a sobra" : "O que fazer com a falta"}</div>
            <div className="card" role="radiogroup">
              {opcoes.map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={dec === o.v} disabled={o.desabilitado} onClick={() => setDec(o.v)} className="linha w-full text-left" style={{ background: dec === o.v ? "#f7f9f6" : undefined, opacity: o.desabilitado ? 0.5 : 1 }}>
                  <span className="flex h-6 w-6 shrink-0 rounded-full" style={{ border: dec === o.v ? "7px solid var(--color-mata)" : "1.5px solid #9ca3af" }} aria-hidden="true" />
                  <span className="flex-1">
                    <span className="t1">{o.titulo}</span>
                    <span className="t2">{o.texto}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mx-[2px] mt-3 text-[13px] leading-[19px] text-cinza">
              {sobra ? "Se faltar, as opções viram: cobrir com a reserva ou levar a falta como primeira conta do mês seguinte." : "Se sobrar, as opções viram: mandar para a reserva ou deixar na conta."}
            </p>
          </section>
          <Erro texto={erro} />
          <Rodape>
            <BotaoPrincipal disabled={enviando || !p.anteriorFechado} onClick={() => enviar("/api/fechamentos", { mes: p.mes, decisao: dec }, { destino: "/casa", aviso: `${p.nomeMes[0].toUpperCase()}${p.nomeMes.slice(1)} fechado` })}>
              {p.mesFuturo ? `Fechar ${p.nomeMes} antes do fim` : `Fechar ${p.nomeMes}`}
            </BotaoPrincipal>
          </Rodape>
        </>
      )}
    </>
  );
}
