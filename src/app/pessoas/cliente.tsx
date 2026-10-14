"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { avisar, useEnviar } from "@/components/form";
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

export function TrocarSenha() {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nova.length < 8) return setErro("A senha nova precisa de pelo menos 8 caracteres.");
    setEnviando(true);
    setErro(null);
    const r = await auth.changePassword({ currentPassword: atual, newPassword: nova, revokeOtherSessions: true });
    setEnviando(false);
    if (r.error) return setErro("A senha atual não confere.");
    setAberto(false);
    setAtual("");
    setNova("");
    avisar("Senha trocada");
  }

  if (!aberto)
    return (
      <button type="button" className="btn p-linha mb-3" onClick={() => setAberto(true)}>
        Trocar minha senha
      </button>
    );
  return (
    <form className="card mb-3 p-4" onSubmit={salvar}>
      <label className="field">
        <div className="flbl">Senha atual</div>
        <input type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required />
      </label>
      <label className="field mt-3">
        <div className="flbl">Senha nova</div>
        <input type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} required minLength={8} />
      </label>
      {erro ? (
        <div className="aviso aviso-vermelho mt-3" role="alert">
          {erro}
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn p-linha" onClick={() => setAberto(false)}>
          Cancelar
        </button>
        <button type="submit" className="btn p-mata" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
