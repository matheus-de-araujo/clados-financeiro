"use client";

import { useState } from "react";
import { avisar, BotaoPrincipal, CampoValor, Campo, Chips, Contador, Erro, Rodape, useEnviar } from "@/components/form";
import { dividirParcelas } from "@/domain/cartao";
import { addMonths, dateInMonth, monthOf, ddmm } from "@/lib/dates";
import { brl } from "@/lib/money";

type Tipo = "suporte" | "projeto" | "hora" | "nenhum";

export function FormNovoCliente({ cliente, hoje }: { cliente: { id: number; nome: string } | null; hoje: string }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipo, setTipo] = useState<Tipo>("suporte");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState(10);
  const [parcelas, setParcelas] = useState(2);
  const [primeira, setPrimeira] = useState(hoje);
  const { enviar, enviando, erro, setErro } = useEnviar();

  const valores = tipo === "projeto" && valor ? dividirParcelas(valor, parcelas) : [];
  const vencs = valores.map((_, i) => dateInMonth(addMonths(monthOf(primeira), i), Number(primeira.slice(8, 10))));

  async function salvar() {
    let clienteId = cliente?.id;
    if (!clienteId) {
      if (!nome.trim()) return setErro("Informe o nome do cliente");
      const c = await enviar("/api/clientes", { nome, telefone: telefone || null });
      if (!c) return;
      clienteId = c.id;
    }
    if (tipo === "nenhum") {
      avisar("Cliente criado");
      window.location.assign(`/clados/clientes/${clienteId}`);
      return;
    }
    const desc = descricao.trim() || (tipo === "suporte" ? "Suporte" : tipo === "hora" ? "Manutenção" : "Projeto");
    const corpo =
      tipo === "suporte"
        ? { clienteId, tipo, descricao: desc, mensalidade: valor, dia, inicioMes: monthOf(hoje) }
        : tipo === "hora"
          ? { clienteId, tipo, descricao: desc, valorHora: valor }
          : { clienteId, tipo, descricao: desc, valorTotal: valor, parcelas: valores.map((v, i) => ({ valor: v, vencimento: vencs[i] })) };
    await enviar("/api/contratos", corpo, { destino: `/clados/clientes/${clienteId}`, aviso: cliente ? "Contrato criado" : "Cliente criado" });
  }

  return (
    <>
      {!cliente ? (
        <>
          <Campo rotulo="Nome do cliente">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Alfa Ltda" maxLength={120} autoFocus />
          </Campo>
          <Campo rotulo="WhatsApp (com DDD)">
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="Ex.: 11 99999-0000" maxLength={30} />
          </Campo>
        </>
      ) : null}
      <Chips
        rotulo="Contrato"
        valor={tipo}
        onChange={setTipo}
        opcoes={[
          { valor: "suporte", texto: "Suporte mensal" },
          { valor: "projeto", texto: "Projeto fechado" },
          { valor: "hora", texto: "Por hora" },
          ...(cliente ? [] : [{ valor: "nenhum" as Tipo, texto: "Só o cliente" }]),
        ]}
      />
      {tipo !== "nenhum" ? (
        <>
          <CampoValor valor={valor} onChange={setValor} rotulo={tipo === "suporte" ? "Mensalidade" : tipo === "hora" ? "Valor da hora" : "Valor do projeto"} autoFocus={false} />
          <Campo rotulo="Descrição">
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "projeto" ? "Ex.: Site institucional" : tipo === "hora" ? "Ex.: Manutenção do site" : "Ex.: Suporte"} maxLength={120} />
          </Campo>
        </>
      ) : null}
      {tipo === "suporte" ? <Contador rotulo="Vence todo dia" valor={dia} onChange={setDia} min={1} max={31} formatar={(n) => `Dia ${n}`} /> : null}
      {tipo === "projeto" ? (
        <>
          <Contador rotulo="Parcelas" valor={parcelas} onChange={setParcelas} min={1} max={12} formatar={(n) => (n === 1 ? "À vista" : `${n} parcelas`)} />
          <Campo rotulo="Primeira parcela em">
            <input type="date" value={primeira} onChange={(e) => setPrimeira(e.target.value)} />
          </Campo>
          {valores.length ? (
            <div className="card mx-4 mt-3">
              {valores.map((v, i) => (
                <div key={i} className="linha">
                  <span className="flex-1 text-[15px]">
                    {valores.length > 1 ? `Parcela ${i + 1}` : "Pagamento"} · {ddmm(vencs[i])}
                  </span>
                  <span className="num text-[15px] font-semibold">{brl(v)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <Erro texto={erro} />
      <Rodape>
        <BotaoPrincipal disabled={enviando || (tipo !== "nenhum" && !valor)} onClick={salvar}>
          {enviando ? "Salvando…" : cliente ? "Criar contrato" : "Salvar cliente"}
        </BotaoPrincipal>
      </Rodape>
    </>
  );
}
