import Link from "next/link";
import { PainelCartao } from "@/components/painel-cartao";
import { TituloPagina, Vazio } from "@/components/ui";
import { getEspaco, listCartoes } from "@/server/base";
import { exigirSessao } from "@/server/sessao";

export const metadata = { title: "Cartões da Casa · Financeiro" };

export default async function CartoesCasa({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const s = await exigirSessao("casa");
  const espaco = await getEspaco(s.db, "casa");
  const cartoes = await listCartoes(s.db, espaco.id);
  const { c: cid } = await searchParams;
  const sel = cartoes.find((c) => c.id === Number(cid)) ?? cartoes[0];
  return (
    <>
      <TituloPagina titulo="Cartões" />
      <div className="rolagem mt-4 px-4">
        {cartoes.map((c) => (
          <Link key={c.id} href={`/casa/cartoes?c=${c.id}`} className={`chip ${c.id === sel?.id ? "on" : ""}`} replace>
            {c.nome}
          </Link>
        ))}
      </div>
      {sel ? <PainelCartao db={s.db} cartao={sel} hoje={s.hoje} edita={s.acesso.casa === "edita"} modo="categorias" /> : <div className="mx-4 mt-4"><Vazio titulo="Nenhum cartão" /></div>}
    </>
  );
}
