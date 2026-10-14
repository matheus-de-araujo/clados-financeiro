"use client";

import { createAuthClient } from "better-auth/react";
import { useEnviar } from "@/components/form";
import { Icone } from "@/components/icones";

const auth = createAuthClient();

export function Acesso({ userId, espaco, papel }: { userId: string; espaco: "clados" | "casa"; papel: "edita" | "ve" | null }) {
  const { enviar, enviando, erro } = useEnviar();
  const opcoes: [("edita" | "ve" | null), string][] = [
    ["edita", "Edita"],
    ["ve", "Vê"],
    [null, "Não"],
  ];
  return (
    <div>
      <div className="flex rounded-full p-[3px]" style={{ background: "var(--color-seg)" }} role="radiogroup" aria-label={`Acesso à ${espaco === "clados" ? "Clados" : "Casa"}`}>
        {opcoes.map(([v, t]) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={papel === v}
            disabled={enviando}
            onClick={() => papel !== v && enviar("/api/membros", { userId, espaco, papel: v }, { aviso: "Acesso atualizado" })}
            className="h-8 rounded-full border-0 px-3 text-[13px] font-semibold"
            style={papel === v ? { background: "#fff", boxShadow: "0 1px 2px rgba(10,31,26,.12)" } : { background: "transparent", color: "var(--color-cinza)" }}
          >
            {t}
          </button>
        ))}
      </div>
      {erro ? <div className="mt-1 text-[12px] text-vermelho">{erro}</div> : null}
    </div>
  );
}

export function Sair() {
  return (
    <button
      type="button"
      className="btn p-linha"
      onClick={async () => {
        await auth.signOut();
        window.location.href = "/entrar";
      }}
    >
      <Icone nome="logout" tam={18} /> Sair
    </button>
  );
}
