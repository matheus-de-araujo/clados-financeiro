import { FormCompra } from "@/components/form-compra";
import { Cabecalho } from "@/components/ui";
import { getEspaco, listCartoes } from "@/server/base";
import { categoriasDo } from "@/server/casa";
import { exigirEdicao } from "@/server/sessao";

export const metadata = { title: "Gastei · Casa" };

export default async function Gastei() {
  const s = await exigirEdicao("casa");
  const e = await getEspaco(s.db, "casa");
  const [cartoes, categorias] = await Promise.all([listCartoes(s.db, e.id), categoriasDo(s.db, e.id)]);
  return (
    <>
      <Cabecalho titulo="Gastei" sub="Casa" voltar="/casa" />
      <FormCompra espaco="casa" cartoes={cartoes} categorias={categorias} hoje={s.hoje} voltar="/casa/extrato" rotuloSemCartao="Débito ou Pix" permitirRepetir />
    </>
  );
}
