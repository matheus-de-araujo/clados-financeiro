"use client";

import { useEffect, useState } from "react";
import { mesDaFatura, vencimentoDaFatura, dividirParcelas } from "@/domain/cartao";
import { ddmm } from "@/lib/dates";
import { brl } from "@/lib/money";
import { BotaoPrincipal, CampoValor, Campo, Chips, Contador, Erro, Interruptor, Rodape, useEnviar } from "./form";

interface CartaoOpcao {
  id: number;
  nome: string;
  diaFecha: number;
  diaVence: number;
}

/** Gastei (Casa) e Paguei (Clados): compra no cartão, no débito ou conta paga pela conta. */
export function FormCompra({ espaco, cartoes, categorias, hoje, voltar, rotuloSemCartao, permitirRepetir }: { espaco: "clados" | "casa"; cartoes: CartaoOpcao[]; categorias: { id: number; nome: string }[]; hoje: string; voltar: string; rotuloSemCartao: string; permitirRepetir: boolean }) {
  const chave = `ultimo-cartao-${espaco}`;
  const [valor, setValor] = useState(0);
  const [cartaoId, setCartaoId] = useState<number | null>(cartoes[0]?.id ?? null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(hoje);
  const [parcelas, setParcelas] = useState(1);
  const [repetir, setRepetir] = useState(false);
  const { enviar, enviando, erro } = useEnviar();

  useEffect(() => {
    try {
      const v = localStorage.getItem(chave);
      if (v === "debito") setCartaoId(null);
      else if (v && cartoes.some((c) => c.id === Number(v))) setCartaoId(Number(v));
    } catch {}
  }, [chave, cartoes]);

  const cartao = cartoes.find((c) => c.id === cartaoId) ?? null;
  const venc = cartao ? vencimentoDaFatura(mesDaFatura(data, cartao.diaFecha, cartao.diaVence), cartao.diaVence) : null;
  const porParcela = parcelas > 1 && valor ? dividirParcelas(valor, parcelas) : null;

  async function salvar() {
    try {
      localStorage.setItem(chave, cartaoId ? String(cartaoId) : "debito");
    } catch {}
    await enviar(
      "/api/compras",
      { espaco, valor, data, descricao, cartaoId, categoriaId, parcelas: cartao ? parcelas : 1, repetir: permitirRepetir ? repetir : false },
      { destino: voltar, aviso: cartao ? "Compra lançada" : "Gasto lançado" },
    );
  }

  return (
    <>
      <CampoValor valor={valor} onChange={setValor} />
      <Chips
        rotulo="Pagou com"
        valor={cartaoId}
        onChange={(v) => {
          setCartaoId(v);
          if (!v) setParcelas(1);
        }}
        opcoes={[...cartoes.map((c) => ({ valor: c.id as number | null, texto: c.nome })), { valor: null, texto: rotuloSemCartao }]}
      />
      <Chips rotulo="Categoria" valor={categoriaId} onChange={setCategoriaId} opcoes={categorias.map((c) => ({ valor: c.id as number | null, texto: c.nome }))} />
      <Campo rotulo="Descrição">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Atacadão" maxLength={120} enterKeyHint="done" />
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} max="2099-12-31" />
      </Campo>
      {cartao && !repetir ? <Contador rotulo="Parcelas" valor={parcelas} onChange={setParcelas} max={24} formatar={(n) => (n === 1 ? "À vista" : `${n}x${porParcela ? ` de ${brl(porParcela[1])}` : ""}`)} /> : null}
      {permitirRepetir && parcelas === 1 ? <Interruptor ligado={repetir} onChange={setRepetir} titulo="Repetir todo mês" texto={espaco === "clados" ? "Vira conta fixa da Clados" : "Vira conta fixa da Casa"} /> : null}
      <p className="mx-4 mt-3 text-[13px] leading-[19px] text-cinza">
        {cartao && venc
          ? `Cai na fatura do ${cartao.nome} que vence em ${ddmm(venc)}${parcelas > 1 ? `, e as outras parcelas nas seguintes` : ""}.`
          : `Sai direto da conta ${espaco === "clados" ? "da Clados" : "da Casa"} nesta data.`}
      </p>
      <Erro texto={erro} />
      <Rodape>
        <BotaoPrincipal disabled={enviando || !valor} onClick={salvar}>
          {enviando ? "Salvando…" : "Salvar"}
        </BotaoPrincipal>
      </Rodape>
    </>
  );
}
