"use client";

import { useState } from "react";
import { BotaoPrincipal, BotaoSecundario, Campo, Chips, Contador, Erro, Rodape, useEnviar } from "@/components/form";
import { formatHoras, valorHoras } from "@/domain/clados";
import { brlShort } from "@/lib/money";

interface C {
  id: number;
  cliente: string;
  descricao: string;
  valorHora: number;
  minutosAbertos: number;
}

export function FormTrabalhei({ contratos, hoje }: { contratos: C[]; hoje: string }) {
  const [id, setId] = useState(contratos[0].id);
  const [meiasHoras, setMeiasHoras] = useState(2);
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(hoje);
  const { enviar, enviando, erro } = useEnviar();
  const c = contratos.find((x) => x.id === id)!;
  const minutos = meiasHoras * 30;
  const desta = valorHoras(minutos, c.valorHora);
  const total = c.minutosAbertos + minutos;

  const salvar = (gerarCobranca: boolean) =>
    enviar("/api/horas", { contratoId: id, minutos, descricao, data, gerarCobranca }, { destino: "/clados", aviso: gerarCobranca ? "Horas salvas e cobrança gerada" : "Horas salvas" });

  return (
    <>
      <Chips rotulo="Cliente" valor={id} onChange={setId} opcoes={contratos.map((k) => ({ valor: k.id, texto: contratos.filter((x) => x.cliente === k.cliente).length > 1 ? `${k.cliente} · ${k.descricao}` : k.cliente }))} />
      <Contador rotulo="Tempo" valor={meiasHoras} onChange={setMeiasHoras} min={1} max={48} formatar={(n) => formatHoras(n * 30)} />
      <Campo rotulo="O que foi feito">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Ajuste no formulário de contato" maxLength={200} />
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <div className="mx-4 mt-3 rounded-[14px] px-4 py-1" style={{ background: "var(--color-mata)", color: "#fff" }}>
        <div className="flex justify-between border-b py-3 text-[14px]" style={{ borderColor: "rgba(255,255,255,.12)", color: "#cfe3dc" }}>
          <span>Desta vez · {brlShort(c.valorHora)}/h</span>
          <b className="num text-white">{brlShort(desta)}</b>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-[15px] font-medium">Ainda não cobrado</span>
          <b className="num text-[17px]" style={{ color: "var(--color-agua)" }}>
            {formatHoras(total)} · {brlShort(valorHoras(total, c.valorHora))}
          </b>
        </div>
      </div>
      <Erro texto={erro} />
      <Rodape>
        <BotaoPrincipal disabled={enviando} onClick={() => salvar(false)}>
          Salvar horas
        </BotaoPrincipal>
        <BotaoSecundario disabled={enviando} onClick={() => salvar(true)}>
          Salvar e gerar cobrança
        </BotaoSecundario>
      </Rodape>
    </>
  );
}
