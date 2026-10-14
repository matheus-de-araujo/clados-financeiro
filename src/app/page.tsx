import { redirect } from "next/navigation";
import { getSessao } from "@/server/sessao";

export default async function Raiz() {
  const s = await getSessao();
  redirect(s ? `/${s.padrao}` : "/entrar");
}
