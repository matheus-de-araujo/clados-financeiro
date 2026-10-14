import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/ui";
import { mesDaFatura } from "@/domain/cartao";
import { ddmm } from "@/lib/dates";
import { getCartao, getEspaco } from "@/server/base";
import { comprasDaFatura, faturaDoMes } from "@/server/casa";
import { exigirEdicao } from "@/server/sessao";
import { FormConferir } from "./form";

export const metadata = { title: "Conferir fatura · Casa" };

export default async function Conferir({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigirEdicao("casa");
  const casa = await getEspaco(s.db, "casa");
  const cartao = await getCartao(s.db, Number((await params).id)).catch(() => null);
  if (!cartao || cartao.espacoId !== casa.id) notFound();
  const mes = mesDaFatura(s.hoje, cartao.diaFecha, cartao.diaVence);
  const f = await faturaDoMes(s.db, cartao, mes);
  const compras = await comprasDaFatura(s.db, cartao.id, mes);
  const desde = f.conferidoEm;
  const recentes = compras.filter((c) => !desde || c.l.criadoEm.toISOString().slice(0, 10) >= desde || c.l.data >= desde).slice(0, 12);
  const banco = cartao.nome.split(" ")[0];
  return (
    <>
      <Cabecalho titulo="Conferir fatura" sub={`${cartao.nome} · aberta, vence ${ddmm(f.vencimento)}`} voltar={`/casa/cartoes?c=${cartao.id}`} />
      <FormConferir
        cartaoId={cartao.id}
        mes={mes}
        banco={banco}
        lancado={f.total}
        ultimo={f.conferidoValor}
        desde={desde}
        recentes={recentes.map(({ l, categoria }) => ({ id: l.id, data: l.data, descricao: l.descricao, categoria: categoria ?? "Sem categoria", valor: l.valor }))}
      />
    </>
  );
}
