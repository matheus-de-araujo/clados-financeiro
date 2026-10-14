import Link from "next/link";
import { and, eq, isNotNull } from "drizzle-orm";
import { ListaContas, type ItemConta } from "@/components/contas";
import { Icone } from "@/components/icones";
import { Cabecalho } from "@/components/ui";
import { contasFixas, faturas, lancamentos } from "@/db/schema";
import { dateInMonth, monthOf, monthYearShort, addMonths } from "@/lib/dates";
import { brl } from "@/lib/money";
import { getEspaco, listCartoes } from "@/server/base";
import { contasDoMes } from "@/server/casa";
import { fixaAtivaNoMes, gerarAoRedor, parcelaNoMes } from "@/server/gerar";
import { exigirSessao } from "@/server/sessao";

export const metadata = { title: "Contas fixas da Clados · Financeiro" };

export default async function ContasClados() {
  const s = await exigirSessao("clados");
  const espaco = await getEspaco(s.db, "clados");
  const mes = monthOf(s.hoje);
  await gerarAoRedor(s.db, espaco, mes);
  const [cartoes, todas, compras, fats, doMes] = await Promise.all([
    listCartoes(s.db, espaco.id),
    s.db.select().from(contasFixas).where(eq(contasFixas.espacoId, espaco.id)),
    s.db.select().from(lancamentos).where(and(eq(lancamentos.espacoId, espaco.id), isNotNull(lancamentos.contaFixaId), eq(lancamentos.mesRef, mes))),
    s.db.select().from(faturas),
    contasDoMes(s.db, espaco.id, mes),
  ]);
  const fixas = todas.filter((f) => fixaAtivaNoMes(f, mes));
  const itens: ItemConta[] = [];
  for (const f of fixas.filter((x) => x.cartaoId)) {
    const compra = compras.find((l) => l.contaFixaId === f.id);
    const fat = compra?.mesFatura ? fats.find((x) => x.cartaoId === f.cartaoId && x.mes === compra.mesFatura) : undefined;
    const p = parcelaNoMes(f, mes);
    const fim = f.parcelasTotal ? addMonths(f.inicioMes, f.parcelasTotal - (f.parcelaInicio ?? 1)) : null;
    itens.push({
      id: null,
      vencimento: dateInMonth(mes, f.dia),
      nome: f.nome,
      sub: `${cartoes.find((c) => c.id === f.cartaoId)?.nome ?? "Cartão"} · ${p ? `parcela ${p} de ${f.parcelasTotal}${fim ? ` · até ${monthYearShort(fim)}` : ""}` : "todo mês"}`,
      valor: f.valor,
      pago: !!fat?.pagoEm,
      podeMarcar: false,
    });
  }
  for (const c of doMes) {
    itens.push({
      id: c.id,
      vencimento: c.vencimento,
      nome: c.nome,
      sub: `${c.forma ?? "Conta"} · ${c.parcela ? `parcela ${c.parcela} de ${c.parcelas}` : "todo mês"}`,
      valor: c.valorPago ?? c.valor,
      pago: !!c.pagoEm,
      podeMarcar: true,
      atrasada: !c.pagoEm && c.vencimento < s.hoje,
    });
  }
  itens.sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
  const total = itens.reduce((a, i) => a + i.valor, 0);

  return (
    <>
      <Cabecalho titulo="Contas fixas" sub={`Clados · ${brl(total)} por mês`} voltar="/clados" />
      <section className="mx-4 mt-4">
        <ListaContas itens={itens} hoje={s.hoje} edita={s.acesso.clados === "edita"} />
        <p className="mx-[2px] mt-3 text-[13px] leading-[19px] text-cinza">Contas no cartão ficam pagas quando você paga a fatura.</p>
        {s.acesso.clados === "edita" ? (
          <Link href="/clados/contas/nova" className="btn p-linha mt-3" style={{ height: 46, fontSize: 15 }}>
            <Icone nome="plus" tam={16} /> Nova conta fixa
          </Link>
        ) : null}
      </section>
    </>
  );
}
