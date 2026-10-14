import { Navegacao } from "@/components/nav";
import { exigirSessao } from "@/server/sessao";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao("clados");
  return (
    <>
      <main className="tela">{children}</main>
      <Navegacao espaco="clados" podeEditar={s.acesso.clados === "edita"} />
    </>
  );
}
