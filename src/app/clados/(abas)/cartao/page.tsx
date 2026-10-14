import { PainelCartao } from "@/components/painel-cartao";
import { TituloPagina, Vazio } from "@/components/ui";
import { getEspaco, listCartoes } from "@/server/base";
import { exigirSessao } from "@/server/sessao";

export const metadata = { title: "Cartão Clados · Financeiro" };

export default async function CartaoClados() {
  const s = await exigirSessao("clados");
  const espaco = await getEspaco(s.db, "clados");
  const [cartao] = await listCartoes(s.db, espaco.id);
  return (
    <>
      <TituloPagina titulo={cartao?.nome ?? "Cartão"} />
      {cartao ? <PainelCartao db={s.db} cartao={cartao} hoje={s.hoje} edita={s.acesso.clados === "edita"} modo="compras" /> : <div className="mx-4 mt-4"><Vazio titulo="Nenhum cartão da Clados" /></div>}
    </>
  );
}
