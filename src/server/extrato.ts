import type { DB } from "@/db";
import type { ItemExtrato } from "@/components/extrato";
import { listCartoes, efeitoNaConta, type Espaco } from "./base";
import { extrato } from "./casa";
import type { MonthKey } from "@/lib/dates";

/** Itens do extrato do mês prontos para a lista. */
export async function itensExtrato(db: DB, espaco: Espaco, mes: MonthKey) {
  const rows = await extrato(db, espaco.id, mes);
  const cartoes = new Map((await listCartoes(db, espaco.id)).map((c) => [c.id, c.nome]));
  const itens: (ItemExtrato & { tipo: string; cartaoId: number | null; retirada: boolean })[] = rows.map(({ l, categoria }) => {
    const parcela = l.parcela ? `parcela ${l.parcela} de ${l.parcelas}` : null;
    let sub: string;
    if (l.tipo === "compra") sub = [cartoes.get(l.cartaoId ?? 0), parcela ?? categoria ?? (l.contaFixaId ? "todo mês" : null)].filter(Boolean).join(" · ");
    else if (l.tipo === "entrada") sub = l.retiradaId ? "Retirada da Clados" : l.recebivelId ? "Recebido" : espaco.tipo === "casa" ? "Entrada" : "Recebido";
    else if (l.tipo === "retirada") sub = "Foi para a Casa";
    else if (l.tipo === "fatura") sub = "Fatura paga";
    else if (l.tipo === "guardar") sub = "Foi para a reserva";
    else if (l.tipo === "resgatar") sub = "Saiu da reserva";
    else sub = l.contaMesId ? "Conta" : [categoria, "Débito ou Pix"].filter(Boolean).join(" · ");
    const efeito = l.tipo === "compra" ? -l.valor : efeitoNaConta(l);
    let titulo = l.descricao;
    if (l.recebivelId && l.descricao.includes(" · ")) {
      const [cliente, ...resto] = l.descricao.split(" · ");
      titulo = cliente;
      sub = `${resto.join(" · ")} · recebido`;
    }
    return {
      id: l.id,
      data: l.data,
      titulo,
      sub,
      valor: efeito,
      cartao: l.tipo === "compra",
      excluivel: l.origem !== "fixa",
      aviso: l.origem === "fixa" ? "Vem de uma conta fixa. Para parar, mude a conta fixa." : l.retiradaId || l.tipo === "retirada" ? "Excluir apaga a retirada nos dois espaços." : l.grupo ? "Excluir apaga todas as parcelas." : undefined,
      tipo: l.tipo,
      cartaoId: l.cartaoId,
      retirada: !!l.retiradaId || l.tipo === "retirada",
    };
  });
  const entrou = itens.filter((i) => !i.cartao && i.valor > 0).reduce((a, i) => a + i.valor, 0);
  const saiu = itens.filter((i) => !i.cartao && i.valor < 0).reduce((a, i) => a - i.valor, 0);
  const noCartao = itens.filter((i) => i.cartao).reduce((a, i) => a - i.valor, 0);
  return { itens, entrou, saiu, noCartao };
}
