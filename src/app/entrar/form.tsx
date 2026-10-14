"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";

const auth = createAuthClient();

export function FormEntrar({ demo }: { demo: { nome: string; email: string; senha: string }[] | null }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: string, s: string) {
    setEnviando(true);
    setErro(null);
    const r = await auth.signIn.email({ email: e, password: s });
    if (r.error) {
      setErro("E-mail ou senha não conferem.");
      setEnviando(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <>
      {demo ? (
        <div className="card mt-8 p-4">
          <div className="text-[15px] font-semibold">Versão de demonstração</div>
          <p className="mt-1 text-[13px] leading-[19px] text-cinza">Os dados são das planilhas de setembro a novembro, e o dia de hoje é 14 de outubro. Entre como:</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demo.map((d) => (
              <button key={d.email} type="button" className="btn p-mata" style={{ height: 46, fontSize: 15 }} disabled={enviando} onClick={() => entrar(d.email, d.senha)}>
                {d.nome}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <form
        className="mt-6"
        onSubmit={(ev) => {
          ev.preventDefault();
          entrar(email, senha);
        }}
      >
        <label className="field">
          <div className="flbl">E-mail</div>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field mt-3">
          <div className="flbl">Senha</div>
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro ? (
          <div className="aviso aviso-vermelho mt-3" role="alert">
            {erro}
          </div>
        ) : null}
        <button type="submit" className="btn p-linha mt-4" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </>
  );
}
