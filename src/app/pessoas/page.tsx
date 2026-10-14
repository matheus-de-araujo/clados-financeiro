import { eq } from "drizzle-orm";
import Link from "next/link";
import { Avatar, Cabecalho } from "@/components/ui";
import { espacos, membros, user } from "@/db/schema";
import { exigirSessao } from "@/server/sessao";
import { Acesso, Sair } from "./cliente";

export const metadata = { title: "Pessoas · Financeiro" };

export default async function Pessoas() {
  const s = await exigirSessao();
  const users = await s.db.select().from(user);
  const ms = await s.db.select({ m: membros, tipo: espacos.tipo }).from(membros).innerJoin(espacos, eq(espacos.id, membros.espacoId));
  const gerencia = s.acesso.clados === "edita";
  return (
    <main className="tela sem-nav">
      <Cabecalho titulo="Pessoas" sub="Quem acessa cada espaço" voltar={`/${s.padrao}`} />
      <p className="mx-4 mt-3 text-[14px] leading-[20px] text-cinza">Cada pessoa abre o app no espaço que mais usa. A Clados e a Casa nunca se misturam; só a retirada passa de uma para a outra.</p>
      {users.map((u) => {
        const meus = ms.filter((x) => x.m.userId === u.id);
        const papel = (t: string) => (meus.find((x) => x.tipo === t)?.m.papel ?? null) as "edita" | "ve" | null;
        const padrao = meus.find((x) => x.m.padrao)?.tipo;
        return (
          <section key={u.id} className="card mx-4 mt-4">
            <div className="linha">
              <Avatar texto={u.name.slice(0, 1).toUpperCase()} cor={u.name === "Dayane" ? "var(--color-agua)" : undefined} />
              <div className="flex-1">
                <span className="t1">{u.name}</span>
                <span className="t2">
                  {u.id === s.user.id ? "Você · " : ""}abre na {padrao === "clados" ? "Clados" : "Casa"}
                </span>
              </div>
            </div>
            {(["clados", "casa"] as const).map((t) => (
              <div key={t} className="linha">
                <div className="flex-1">
                  <span className="t1">{t === "clados" ? "Clados" : "Casa"}</span>
                  <span className="t2">{papel(t) === "edita" ? "Pode lançar e editar" : papel(t) === "ve" ? "Só visualiza, não lança" : "Sem acesso"}</span>
                </div>
                {gerencia && u.id !== s.user.id ? <Acesso userId={u.id} espaco={t} papel={papel(t)} /> : null}
              </div>
            ))}
          </section>
        );
      })}
      <section className="mx-4 mt-6">
        <Sair />
        {s.demo ? (
          <p className="mt-4 text-center text-[13px] leading-[19px] text-cinza">
            Versão de demonstração, com os dados das planilhas.{" "}
            <Link href="/entrar" className="text-verde">
              Trocar de pessoa
            </Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
