import { exigirSessao } from "@/server/sessao";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirSessao("clados");
  return <main className="tela sem-nav">{children}</main>;
}
