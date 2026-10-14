"use client";

import Link from "next/link";
import { useState } from "react";
import { BotaoPrincipal, CampoValor, Campo, Erro, Rodape, useEnviar } from "@/components/form";
import { brl } from "@/lib/money";

export function FormEntrou({ hoje, nome, temClados }: { hoje: string; nome: string; temClados: boolean }) {
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState(`Renda ${nome === "Dayane" ? "da Dayane" : `de ${nome}`}`);
  const [data, setData] = useState(hoje);
  const { enviar, enviando, erro } = useEnviar();
  return (
    <>
      <CampoValor valor={valor} onChange={setValor} />
      <Campo rotulo="De onde veio">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} />
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <p className="mx-4 mt-3 text-[13px] leading-[19px] text-cinza">
        Entra na conta da Casa e diminui quanto o Matheus precisa retirar da Clados no mês.
        {temClados ? (
          <>
            {" "}
            Retirada da Clados se lança pela{" "}
            <Link href="/clados/retirada" className="font-medium text-verde">
              Clados
            </Link>
            .
          </>
        ) : null}
      </p>
      <Erro texto={erro} />
      <Rodape>
        <BotaoPrincipal disabled={enviando || !valor} onClick={() => enviar("/api/entradas", { valor, data, descricao }, { destino: "/casa", aviso: `Entrada de ${brl(valor)} lançada` })}>
          {enviando ? "Salvando…" : "Salvar entrada"}
        </BotaoPrincipal>
      </Rodape>
    </>
  );
}
