import { Cabecalho } from "@/components/ui";
import { addDays } from "@/lib/dates";
import { faturadoNoAno, recebiveisAbertos } from "@/server/clados";
import { getEspaco } from "@/server/base";
import { exigirEdicao } from "@/server/sessao";
import { FormRecebi } from "./form";

export const metadata = { title: "Recebi · Clados" };

export default async function Recebi() {
  const s = await exigirEdicao("clados");
  const e = await getEspaco(s.db, "clados");
  const [abertos, faturado] = await Promise.all([recebiveisAbertos(s.db), faturadoNoAno(s.db, e, Number(s.hoje.slice(0, 4)))]);
  // Mostra o que já venceu e o que vence nos próximos 45 dias.
  const limite = addDays(s.hoje, 45);
  const lista = abertos.filter((a) => a.r.vencimento <= limite).map((a) => ({ id: a.r.id, cliente: a.cliente.nome, descricao: a.r.descricao, valor: a.r.valor, vencimento: a.r.vencimento }));
  return (
    <>
      <Cabecalho titulo="Recebi" sub="O que entrou na conta?" voltar="/clados" />
      <FormRecebi abertos={lista} hoje={s.hoje} faturado={faturado} />
    </>
  );
}
