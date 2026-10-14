import { FormContaFixa } from "@/components/form-conta-fixa";
import { Cabecalho } from "@/components/ui";
import { getEspaco, listCartoes } from "@/server/base";
import { exigirEdicao } from "@/server/sessao";

export const metadata = { title: "Nova conta fixa · Casa" };

export default async function NovaConta() {
  const s = await exigirEdicao("casa");
  const e = await getEspaco(s.db, "casa");
  const cartoes = await listCartoes(s.db, e.id);
  return (
    <>
      <Cabecalho titulo="Nova conta fixa" sub="Casa" voltar="/casa/contas" />
      <FormContaFixa espaco="casa" cartoes={cartoes.map((c) => ({ id: c.id, nome: c.nome }))} hoje={s.hoje} voltar="/casa/contas" />
    </>
  );
}
