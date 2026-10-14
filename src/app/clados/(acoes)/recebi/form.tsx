"use client";

import { useState } from "react";
import { BotaoPrincipal, CampoValor, Campo, Erro, Interruptor, Rodape, useEnviar } from "@/components/form";
import { ddmm } from "@/lib/dates";
import { brlShort } from "@/lib/money";

interface Aberto {
  id: number;
  cliente: string;
  descricao: string;
  valor: number;
  vencimento: string;
}

export function FormRecebi({ abertos, hoje, faturado }: { abertos: Aberto[]; hoje: string; faturado: number }) {
  const [sel, setSel] = useState<number | null>(abertos[0]?.id ?? null);
  const [valorOutro, setValorOutro] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(hoje);
  const [nf, setNf] = useState(true);
  const { enviar, enviando, erro } = useEnviar();
  const escolhido = abertos.find((a) => a.id === sel) ?? null;
  const valor = escolhido ? escolhido.valor : valorOutro;

  return (
    <>
      <section className="sec">
        <div className="lbl">Esperando pagamento</div>
        <div className="card" role="radiogroup" aria-label="O que foi pago">
          {abertos.map((a) => {
            const atrasado = a.vencimento < hoje;
            return (
              <button key={a.id} type="button" role="radio" aria-checked={sel === a.id} onClick={() => setSel(a.id)} className="linha w-full text-left" style={sel === a.id ? { background: "#f7f9f6" } : undefined}>
                <Radio on={sel === a.id} />
                <span className="min-w-0 flex-1">
                  <span className="t1">{a.cliente}</span>
                  <span className="t2" style={{ color: atrasado ? "var(--color-vermelho)" : undefined }}>
                    {a.descricao} · {atrasado ? "atrasado" : `vence ${ddmm(a.vencimento)}`}
                  </span>
                </span>
                <span className="num text-[15px] font-semibold text-verde">{brlShort(a.valor)}</span>
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={sel === null} onClick={() => setSel(null)} className="linha w-full text-left">
            <Radio on={sel === null} />
            <span className="t1 flex-1">Outro valor</span>
          </button>
        </div>
      </section>
      {sel === null ? (
        <>
          <CampoValor valor={valorOutro} onChange={setValorOutro} autoFocus={false} />
          <Campo rotulo="De quem ou do quê">
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Projeto avulso" maxLength={120} />
          </Campo>
        </>
      ) : null}
      <Campo rotulo="Data do recebimento">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <Interruptor ligado={nf} onChange={setNf} titulo="Nota fiscal emitida" texto="Fica marcado no recebimento" />
      <p className="mx-4 mt-3 text-[13px] leading-[19px] text-cinza">
        Entra no faturamento do MEI: {brlShort(faturado + valor)} de R$ 81.000 em {data.slice(0, 4)}.
      </p>
      <Erro texto={erro} />
      <Rodape>
        <BotaoPrincipal
          disabled={enviando || !valor}
          onClick={() => enviar("/api/recebimentos", { recebivelId: sel, valor, data, descricao: sel ? undefined : descricao, nf }, { destino: "/clados", aviso: `Recebido ${brlShort(valor)}` })}
        >
          {enviando ? "Salvando…" : "Confirmar recebimento"}
        </BotaoPrincipal>
      </Rodape>
    </>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ border: on ? "7px solid var(--color-mata)" : "1.5px solid #9ca3af", background: "#fff" }} aria-hidden="true" />
  );
}
