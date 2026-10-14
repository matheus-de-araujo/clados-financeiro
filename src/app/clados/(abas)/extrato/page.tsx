import { PaginaExtrato } from "@/components/pagina-extrato";
import { getEspaco } from "@/server/base";
import { exigirSessao, mesDaUrl } from "@/server/sessao";

export const metadata = { title: "Extrato da Clados · Financeiro" };

export default async function ExtratoClados({ searchParams }: { searchParams: Promise<{ m?: string; f?: string }> }) {
  const s = await exigirSessao("clados");
  const sp = await searchParams;
  const espaco = await getEspaco(s.db, "clados");
  return (
    <PaginaExtrato
      db={s.db}
      espaco={espaco}
      mes={mesDaUrl(sp, s.hoje)}
      filtro={sp.f ?? "tudo"}
      hoje={s.hoje}
      edita={s.acesso.clados === "edita"}
      filtros={[
        { chave: "tudo", texto: "Tudo", teste: () => true },
        { chave: "entradas", texto: "Entradas", teste: (i) => i.valor > 0 },
        { chave: "saidas", texto: "Saídas", teste: (i) => i.valor < 0 && !i.retirada },
        { chave: "retiradas", texto: "Retiradas", teste: (i) => i.retirada },
      ]}
    />
  );
}
