import { exigirEdicao } from "@/server/sessao";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirEdicao("casa");
  return <main className="tela sem-nav">{children}</main>;
}
