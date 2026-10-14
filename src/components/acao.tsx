"use client";

import type { ReactNode } from "react";
import { useEnviar } from "./form";

/** Botão que chama a API e atualiza a tela. */
export function BotaoAcao({ url, corpo, children, aviso, className = "pill p-linha", confirmar, destino, rotulo }: { url: string; corpo: unknown; children: ReactNode; aviso?: string; className?: string; confirmar?: string; destino?: string; rotulo?: string }) {
  const { enviar, enviando, erro } = useEnviar();
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={enviando}
        aria-label={rotulo}
        onClick={async () => {
          if (confirmar && !window.confirm(confirmar)) return;
          await enviar(url, corpo, { aviso, destino });
        }}
      >
        {children}
      </button>
      {erro ? (
        <span role="alert" className="block text-[12px] text-vermelho">
          {erro}
        </span>
      ) : null}
    </>
  );
}
