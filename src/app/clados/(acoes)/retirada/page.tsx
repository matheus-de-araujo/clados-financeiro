import { Cabecalho } from "@/components/ui";
import { monthOf } from "@/lib/dates";
import { mesClados } from "@/server/clados";
import { exigirEdicao } from "@/server/sessao";
import { FormRetirada } from "./form";

export const metadata = { title: "Retirada · Clados" };

export default async function Retirada() {
  const s = await exigirEdicao("clados");
  const c = await mesClados(s.db, monthOf(s.hoje), s.hoje);
  return (
    <>
      <Cabecalho titulo="Retirada" sub="Sai da Clados e entra na Casa" voltar="/clados" />
      <FormRetirada pode={c.podeRetirar} retirado={c.retirado} meta={c.metaRetirada} reserva={c.espaco.reservaMinima} hoje={s.hoje} />
    </>
  );
}
