import { PaginaExtrato } from "@/components/pagina-extrato";
import { getEspaco, listCartoes } from "@/server/base";
import { exigirSessao, mesDaUrl } from "@/server/sessao";

export const metadata = { title: "Extrato da Casa · Financeiro" };

export default async function ExtratoCasa({ searchParams }: { searchParams: Promise<{ m?: string; f?: string }> }) {
  const s = await exigirSessao("casa");
  const sp = await searchParams;
  const espaco = await getEspaco(s.db, "casa");
  const cartoes = await listCartoes(s.db, espaco.id);
  return (
    <PaginaExtrato
      db={s.db}
      espaco={espaco}
      mes={mesDaUrl(sp, s.hoje)}
      filtro={sp.f ?? "tudo"}
      hoje={s.hoje}
      edita={s.acesso.casa === "edita"}
      filtros={[
        { chave: "tudo", texto: "Tudo", teste: () => true },
        { chave: "conta", texto: "Conta", teste: (i) => !i.cartao },
        ...cartoes.map((c) => ({ chave: `c${c.id}`, texto: c.nome, teste: (i: { cartaoId: number | null; cartao: boolean }) => i.cartao && i.cartaoId === c.id })),
      ]}
    />
  );
}
