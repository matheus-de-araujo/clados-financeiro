"use client";

import { useState } from "react";
import { CampoValor, Erro, useEnviar } from "@/components/form";
import { brl } from "@/lib/money";

export function FormReserva({ hoje, reserva }: { hoje: string; reserva: number }) {
  const [acao, setAcao] = useState<"guardar" | "resgatar" | null>(null);
  const [valor, setValor] = useState(0);
  const { enviar, enviando, erro } = useEnviar();
  return (
    <>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-[10px]">
        <button type="button" className={`btn ${acao === "guardar" ? "p-mata" : "p-linha"}`} style={{ height: 46, fontSize: 15 }} onClick={() => setAcao("guardar")}>
          Guardar
        </button>
        <button type="button" className={`btn ${acao === "resgatar" ? "p-mata" : "p-linha"}`} style={{ height: 46, fontSize: 15 }} onClick={() => setAcao("resgatar")} disabled={reserva <= 0}>
          Usar
        </button>
      </div>
      {acao ? (
        <div className="card mx-4 mt-3 px-4 pb-4">
          <CampoValor valor={valor} onChange={setValor} rotulo={acao === "guardar" ? "Quanto vai para a reserva" : "Quanto sai da reserva"} />
          <p className="mt-2 text-center text-[13px] text-cinza">{acao === "guardar" ? "Sai da conta da Casa e vai para a reserva." : `Volta para a conta da Casa. Disponível: ${brl(reserva)}.`}</p>
          <Erro texto={erro} />
          <button type="button" className="btn p-mata mt-4" disabled={enviando || !valor} onClick={async () => { if (await enviar("/api/reserva", { acao, valor, data: hoje }, { aviso: acao === "guardar" ? "Guardado na reserva" : "Saiu da reserva" })) { setAcao(null); setValor(0); } }}>
            {acao === "guardar" ? `Guardar ${brl(valor)}` : `Usar ${brl(valor)}`}
          </button>
        </div>
      ) : null}
    </>
  );
}
