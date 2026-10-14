"use client";

import { useState } from "react";
import { addMonths, monthOf, monthYearShort } from "@/lib/dates";
import { BotaoPrincipal, CampoValor, Campo, Chips, Contador, Erro, Interruptor, Rodape, useEnviar } from "./form";

type Tipo = "normal" | "dizimo" | "reserva";

export function FormContaFixa({ espaco, cartoes, hoje, voltar }: { espaco: "clados" | "casa"; cartoes: { id: number; nome: string }[]; hoje: string; voltar: string }) {
  const [tipo, setTipo] = useState<Tipo>("normal");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState(Number(hoje.slice(8, 10)));
  const [forma, setForma] = useState<string | number>("Boleto");
  const [parcelado, setParcelado] = useState(false);
  const [atual, setAtual] = useState(1);
  const [total, setTotal] = useState(12);
  const [inicio, setInicio] = useState(monthOf(hoje));
  const { enviar, enviando, erro } = useEnviar();

  const cartaoId = typeof forma === "number" ? forma : null;
  const fim = parcelado ? addMonths(inicio, total - atual) : null;

  async function salvar() {
    await enviar(
      "/api/contas-fixas",
      {
        espaco,
        nome: tipo === "dizimo" ? nome || "Dízimo" : tipo === "reserva" ? nome || "Guardar na reserva" : nome,
        dia,
        valor: tipo === "dizimo" ? 0 : valor,
        tipo,
        cartaoId: tipo === "normal" ? cartaoId : null,
        forma: cartaoId ? null : String(forma),
        parcelaAtual: parcelado ? atual : null,
        parcelasTotal: parcelado ? total : null,
        inicioMes: inicio,
      },
      { destino: voltar, aviso: "Conta fixa criada" },
    );
  }

  return (
    <>
      {espaco === "casa" ? (
        <Chips
          rotulo="Tipo"
          valor={tipo}
          onChange={setTipo}
          opcoes={[
            { valor: "normal", texto: "Conta" },
            { valor: "reserva", texto: "Guardar na reserva" },
            { valor: "dizimo", texto: "Dízimo (10%)" },
          ]}
        />
      ) : null}
      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tipo === "dizimo" ? "Dízimo" : tipo === "reserva" ? "Guardar na reserva" : "Ex.: Internet"} maxLength={80} />
      </Campo>
      {tipo === "dizimo" ? (
        <p className="mx-4 mt-3 text-[13px] leading-[19px] text-cinza">O valor é calculado: 10% das retiradas que a Casa recebe no mês.</p>
      ) : (
        <CampoValor valor={valor} onChange={setValor} rotulo={parcelado ? "Valor da parcela" : "Valor por mês"} autoFocus={false} />
      )}
      <Contador rotulo="Vence todo dia" valor={dia} onChange={setDia} min={1} max={31} formatar={(n) => `Dia ${n}`} />
      {tipo === "normal" ? (
        <Chips rotulo="Paga com" valor={forma} onChange={setForma} opcoes={[{ valor: "Boleto" as string | number, texto: "Boleto" }, { valor: "Débito ou Pix", texto: "Débito ou Pix" }, ...cartoes.map((c) => ({ valor: c.id as string | number, texto: c.nome }))]} />
      ) : null}
      <Campo rotulo="Começa em">
        <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </Campo>
      {tipo === "normal" ? <Interruptor ligado={parcelado} onChange={setParcelado} titulo="É parcelado" texto="Financiamento, carnê ou compra parcelada" /> : null}
      {parcelado ? (
        <>
          <Contador rotulo="Parcela deste mês" valor={atual} onChange={setAtual} min={1} max={total} formatar={(n) => `${n} de ${total}`} />
          <Contador rotulo="Total de parcelas" valor={total} onChange={(n) => { setTotal(n); if (atual > n) setAtual(n); }} min={2} max={600} formatar={(n) => `${n} parcelas${fim ? ` · termina em ${monthYearShort(fim)}` : ""}`} />
        </>
      ) : null}
      {cartaoId ? <p className="mx-4 mt-3 text-[13px] leading-[19px] text-cinza">Todo mês entra como compra no cartão e fica paga quando a fatura for paga.</p> : null}
      <Erro texto={erro} />
      <Rodape>
        <BotaoPrincipal disabled={enviando || (tipo !== "dizimo" && (!valor || (tipo === "normal" && !nome.trim())))} onClick={salvar}>
          {enviando ? "Salvando…" : "Criar conta fixa"}
        </BotaoPrincipal>
      </Rodape>
    </>
  );
}
