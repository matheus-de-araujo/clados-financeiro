import { FormContaFixa } from "@/components/form-conta-fixa";
import { Cabecalho } from "@/components/ui";
import { getEspaco, listCartoes } from "@/server/base";
import { exigirEdicao } from "@/server/sessao";

export const metadata = { title: "Nova conta fixa · Clados" };

export default async function NovaConta() {
  const s = await exigirEdicao("clados");
  const e = await getEspaco(s.db, "clados");
  const cartoes = await listCartoes(s.db, e.id);
  return (
    <>
      <Cabecalho titulo="Nova conta fixa" sub="Clados" voltar="/clados/contas" />
      <FormContaFixa espaco="clados" cartoes={cartoes.map((c) => ({ id: c.id, nome: c.nome }))} hoje={s.hoje} voltar="/clados/contas" />
    </>
  );
}
