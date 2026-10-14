import { FormCompra } from "@/components/form-compra";
import { Cabecalho } from "@/components/ui";
import { getEspaco, listCartoes } from "@/server/base";
import { categoriasDo } from "@/server/casa";
import { exigirEdicao } from "@/server/sessao";

export const metadata = { title: "Paguei · Clados" };

export default async function Paguei() {
  const s = await exigirEdicao("clados");
  const e = await getEspaco(s.db, "clados");
  const [cartoes, categorias] = await Promise.all([listCartoes(s.db, e.id), categoriasDo(s.db, e.id)]);
  return (
    <>
      <Cabecalho titulo="Paguei" sub="Clados" voltar="/clados" />
      <FormCompra espaco="clados" cartoes={cartoes} categorias={categorias} hoje={s.hoje} voltar="/clados/extrato" rotuloSemCartao="Conta Clados" permitirRepetir />
    </>
  );
}
