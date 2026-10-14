import { Navegacao } from "@/components/nav";
import { exigirSessao } from "@/server/sessao";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao("casa");
  return (
    <>
      <main className="tela">{children}</main>
      <Navegacao espaco="casa" podeEditar={s.acesso.casa === "edita"} />
    </>
  );
}
