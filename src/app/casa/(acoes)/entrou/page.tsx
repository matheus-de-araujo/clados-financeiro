import { Cabecalho } from "@/components/ui";
import { exigirEdicao } from "@/server/sessao";
import { FormEntrou } from "./form";

export const metadata = { title: "Entrou · Casa" };

export default async function Entrou() {
  const s = await exigirEdicao("casa");
  return (
    <>
      <Cabecalho titulo="Entrou" sub="Renda da Dayane ou outra entrada na Casa" voltar="/casa" />
      <FormEntrou hoje={s.hoje} nome={s.user.name} temClados={s.acesso.clados === "edita"} />
    </>
  );
}
