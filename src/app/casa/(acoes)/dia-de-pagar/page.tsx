import Link from "next/link";
import { BotaoAcao } from "@/components/acao";
import { ListaContas } from "@/components/contas";
import { Icone } from "@/components/icones";
import { Avatar, Cabecalho, Secao } from "@/components/ui";
import { ddmm, monthName, monthTitle } from "@/lib/dates";
import { brl, brlShort } from "@/lib/money";
import { mesCasa } from "@/server/casa";
import { itensContasCasa } from "@/server/casa-itens";
import { exigirEdicao, mesDaUrl } from "@/server/sessao";

export const metadata = { title: "Dia de pagar · Casa" };

export default async function DiaDePagar({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const s = await exigirEdicao("casa");
  const mes = mesDaUrl(await searchParams, s.hoje);
  const m = await mesCasa(s.db, mes, s.hoje);
  const contas = itensContasCasa(m, s.hoje).filter((c) => c.id && !c.pago);
  const faturas = m.faturas.filter((f) => f.total > 0 && !f.pagoEm);
  const aPagar = contas.reduce((a, c) => a + c.valor, 0) + faturas.reduce((a, f) => a + f.total, 0);
  const depois = m.saldoConta - aPagar;
  const tudoPago = contas.length === 0 && faturas.length === 0;

  return (
    <>
      <Cabecalho titulo="Dia de pagar" sub={`${monthTitle(mes)} · Casa`} voltar={`/casa?m=${mes}`} />

      <div className="card mx-4 mt-4">
        <div className="linha">
          <span className="flex-1 text-[15px]">Na conta agora</span>
          <span className="num text-[15px] font-semibold" style={{ color: m.saldoConta < 0 ? "var(--color-vermelho)" : undefined }}>
            {brl(m.saldoConta)}
          </span>
        </div>
        <div className="linha">
          <span className="flex-1 text-[15px]">Ainda para pagar em {monthName(mes)}</span>
          <span className="num text-[15px] font-semibold">{brl(aPagar)}</span>
        </div>
        <div className="linha">
          <span className="flex-1 text-[15px] font-medium">Depois de pagar tudo</span>
          <span className="num text-[15px] font-semibold" style={{ color: depois < 0 ? "var(--color-vermelho)" : "var(--color-verde)" }}>
            {brl(depois)}
          </span>
        </div>
      </div>

      <Secao titulo="1. Juntar o que entrou">
        <div className="card">
          <div className="linha">
            <span className="flex-1">
              <span className="t1">Entrou em {monthName(mes)}</span>
              <span className="t2">
                Retiradas {brlShort(m.retiradas)}
                {m.outrasEntradas ? ` · outras ${brlShort(m.outrasEntradas)}` : ""}
              </span>
            </span>
            <span className="num text-[15px] font-semibold text-verde">{brlShort(m.resumo.entrou)}</span>
          </div>
          {m.resumo.faltaEntrar > 0 ? (
            <div className="linha">
              <span className="flex-1 text-[15px] text-vermelho">Falta entrar</span>
              <span className="num text-[15px] font-semibold text-vermelho">{brlShort(m.resumo.faltaEntrar)}</span>
            </div>
          ) : null}
          <div className="linha gap-2">
            <Link href="/casa/entrou" className="pill p-linha flex-1">
              <Icone nome="in" tam={16} /> Entrou dinheiro
            </Link>
            {s.acesso.clados === "edita" ? (
              <Link href="/clados/retirada" className="pill p-mata flex-1">
                <Icone nome="wallet" tam={16} /> Fazer retirada
              </Link>
            ) : null}
          </div>
        </div>
      </Secao>

      <Secao titulo="2. Pagar as contas">
        {contas.length ? <ListaContas itens={contas} hoje={s.hoje} edita /> : <div className="card px-4 py-4 text-[15px]">Todas as contas de {monthName(mes)} estão pagas.</div>}
      </Secao>

      <Secao titulo="3. Pagar as faturas">
        {faturas.length ? (
          <div className="card">
            {faturas.map((f) => (
              <div key={f.cartao.id} className="linha">
                <Avatar texto={f.cartao.sigla} cor={f.cartao.dono === "Dayane" ? "var(--color-agua)" : f.cartao.dono ? undefined : "var(--color-trilho)"} tam={36} />
                <span className="min-w-0 flex-1">
                  <span className="t1">{f.cartao.nome}</span>
                  <span className="num block text-[15px] font-semibold">{brl(f.total)}</span>
                  <span className="t2">
                    Vence {ddmm(f.vencimento)} ·{" "}
                    <Link href={`/casa/cartoes/${f.cartao.id}/conferir`} className="text-verde">
                      {f.conferidoEm ? `conferida em ${ddmm(f.conferidoEm)}` : "conferir"}
                    </Link>
                  </span>
                </span>
                <BotaoAcao url="/api/faturas/pagar" corpo={{ cartaoId: f.cartao.id, mes: f.mes, data: s.hoje }} aviso={`Fatura ${f.cartao.nome} paga`} className="pill p-mata" rotulo={`Marcar fatura ${f.cartao.nome} como paga`}>
                  Paguei
                </BotaoAcao>
              </div>
            ))}
          </div>
        ) : (
          <div className="card px-4 py-4 text-[15px]">Nenhuma fatura em aberto vencendo em {monthName(mes)}.</div>
        )}
      </Secao>

      {tudoPago ? (
        <section className="sec">
          <Link href={`/casa/fechamento?m=${mes}`} className="btn p-mata">
            Tudo pago. Fechar {monthName(mes)}
          </Link>
        </section>
      ) : null}
      <div className="h-6" />
    </>
  );
}
