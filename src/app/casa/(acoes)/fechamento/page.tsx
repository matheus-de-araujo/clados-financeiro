import { Cabecalho } from "@/components/ui";
import { addMonths, monthName, monthOf, monthTitle } from "@/lib/dates";
import { getFechamento } from "@/server/base";
import { mesCasa } from "@/server/casa";
import { exigirEdicao, mesDaUrl } from "@/server/sessao";
import { FormFechamento } from "./form";

export const metadata = { title: "Fechar o mês · Casa" };

export default async function Fechamento({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const s = await exigirEdicao("casa");
  const sp = await searchParams;
  const mes = sp.m ? mesDaUrl(sp, s.hoje) : addMonths(monthOf(s.hoje), -1);
  const pm = mesCasa(s.db, mes, s.hoje);
  const [m, proximo, fechAnterior] = await Promise.all([
    pm,
    pm.then((x) => getFechamento(s.db, x.espaco.id, addMonths(mes, 1))),
    pm.then((x) => getFechamento(s.db, x.espaco.id, addMonths(mes, -1))),
  ]);
  const r = m.resumo;
  const anteriorFechado = mes <= monthOf(m.espaco.dataInicio) || !!fechAnterior;
  const abertas = m.contas.filter((c) => !c.pagoEm).length + m.faturas.filter((f) => f.total > 0 && !f.pagoEm).length;
  return (
    <>
      <Cabecalho titulo={m.fechamento ? `${monthTitle(mes)} fechou` : `Fechar ${monthName(mes)}`} sub="Casa" voltar={`/casa?m=${mes}`} />
      <FormFechamento
        mes={mes}
        nomeMes={monthName(mes)}
        proximoMes={monthName(addMonths(mes, 1))}
        resultado={r.resultado}
        resultadoDoMes={m.resultadoDoMes}
        linhas={[
          { texto: "Entrou", valor: r.entrou - r.sobraAnterior },
          ...(r.sobraAnterior ? [{ texto: `Sobra de ${monthName(addMonths(mes, -1))}`, valor: r.sobraAnterior }] : []),
          { texto: "Contas, faturas e gastos", valor: -(r.precisa - r.faltaAnterior) },
          ...(r.faltaAnterior ? [{ texto: `Falta de ${monthName(addMonths(mes, -1))}`, valor: -r.faltaAnterior }] : []),
        ]}
        reserva={m.reserva}
        fechamento={m.fechamento ? { decisao: m.fechamento.decisao, resultado: m.fechamento.resultado } : null}
        podeReabrir={!proximo}
        anteriorFechado={anteriorFechado}
        abertas={abertas}
        mesFuturo={mes >= monthOf(s.hoje)}
      />
    </>
  );
}
