import Link from "next/link";
import { BotaoAcao } from "@/components/acao";
import { Icone } from "@/components/icones";
import { Topo } from "@/components/topo";
import { Barra, CaixaData, Grande, LinhaLink, Secao } from "@/components/ui";
import { formatHoras } from "@/domain/clados";
import { daysBetween, ddmm, monthTitle } from "@/lib/dates";
import { brl, brlShort } from "@/lib/money";
import { linkWhatsApp, mensagemCobranca } from "@/lib/whatsapp";
import { mesClados } from "@/server/clados";
import { exigirSessao, mesDaUrl } from "@/server/sessao";

export const metadata = { title: "Clados · Financeiro" };

export default async function InicioClados({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const s = await exigirSessao("clados");
  const mes = mesDaUrl(await searchParams, s.hoje);
  const c = await mesClados(s.db, mes, s.hoje);
  const edita = s.acesso.clados === "edita";
  const pctRetirado = c.metaRetirada > 0 ? (c.retirado / c.metaRetirada) * 100 : 100;
  const faltaParaCasa = Math.max(0, c.metaRetirada - c.retirado);
  const aReceber = [...c.atrasados.map((a) => a.cliente.nome), ...c.horasAbertas.map((h) => h.cliente.nome)];
  const nomes = [...new Set(aReceber)].slice(0, 2);
  const fixasAno = c.necessario * 12;
  const dentroMei = fixasAno <= c.mei.limite;

  return (
    <>
      <Topo ativo="clados" acesso={s.acesso} mes={mes} nome={s.user.name} />

      <section className="px-4 pt-4">
        <div className="text-[13px] text-cinza">Saldo na conta da Clados</div>
        <Grande valor={c.saldo} />
      </section>

      <section className="mx-4 mt-5 rounded-[18px] p-5" style={{ background: "var(--color-mata)", color: "#fff" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-medium">Pode retirar agora</div>
            <div className="text-[13px]" style={{ color: "#a7c4ba" }}>
              Já separei contas, cartão e reserva
            </div>
          </div>
          <div className="num text-[26px] font-semibold" style={{ color: "var(--color-agua)" }}>
            {brlShort(c.podeRetirar)}
          </div>
        </div>
        <div className="my-4 h-px" style={{ background: "rgba(255,255,255,.12)" }} />
        <div className="flex items-baseline justify-between text-[14px]" style={{ color: "#cfe3dc" }}>
          <span>Retirado para a Casa</span>
          <span className="num">
            <b className="text-white">{brlShort(c.retirado)}</b> de {brlShort(c.metaRetirada)}
          </span>
        </div>
        <div className="mt-2 h-[6px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>
          <i className="block h-full rounded-full" style={{ width: `${Math.min(100, pctRetirado)}%`, background: "var(--color-agua)" }} />
        </div>
        {faltaParaCasa > 0 ? (
          <div className="aviso aviso-escuro mt-4">
            <span className="shrink-0" style={{ color: "var(--color-agua)" }}>
              <Icone nome="alert" tam={18} />
            </span>
            <span>
              {faltaParaCasa > c.podeRetirar ? (
                <>
                  Faltam <b>{brlShort(faltaParaCasa)}</b> para a Casa e só dá para retirar {brlShort(c.podeRetirar)}.
                  {nomes.length ? ` Receber de ${nomes.join(" e ")} ajuda a cobrir o resto.` : " Faltam recebimentos para cobrir o resto."}
                </>
              ) : (
                <>
                  Faltam <b>{brlShort(faltaParaCasa)}</b> para a Casa em {monthTitle(mes).toLowerCase()} e dá para retirar agora.
                </>
              )}
            </span>
          </div>
        ) : (
          <div className="aviso aviso-escuro mt-4">A Casa já recebeu o que precisa em {monthTitle(mes).toLowerCase()}.</div>
        )}
        {edita ? (
          <Link href="/clados/retirada" className="btn p-agua mt-4">
            Fazer retirada
          </Link>
        ) : null}
      </section>

      {c.atrasados.length + c.horasAbertas.length > 0 ? (
        <Secao titulo="Precisa de você">
          <div className="card">
            {c.atrasados.map((a) => {
              const dias = daysBetween(a.r.vencimento, s.hoje);
              return (
                <div key={a.r.id} className="linha">
                  <CaixaData data={a.r.vencimento} alerta />
                  <Link href={`/clados/clientes/${a.cliente.id}`} className="min-w-0 flex-1">
                    <span className="t1">{a.cliente.nome}</span>
                    <span className="t2" style={{ color: "var(--color-vermelho)" }}>
                      {a.r.descricao} · atrasado há {dias} {dias === 1 ? "dia" : "dias"}
                    </span>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num text-[15px] font-semibold">{brlShort(a.r.valor)}</span>
                    {a.cliente.telefone ? (
                      <a className="pill p-linha" style={{ height: 32 }} target="_blank" rel="noreferrer" href={linkWhatsApp(a.cliente.telefone, mensagemCobranca(a.cliente.nome, a.r.descricao, a.r.valor, a.r.vencimento))}>
                        <Icone nome="msg" tam={15} /> WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {c.horasAbertas.map((h) => (
              <div key={h.contrato.id} className="linha">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "var(--color-fundo)" }}>
                  <Icone nome="clock" />
                </div>
                <Link href={`/clados/clientes/${h.cliente.id}`} className="min-w-0 flex-1">
                  <span className="t1">{h.cliente.nome}</span>
                  <span className="t2">{formatHoras(h.minutos)} de manutenção não cobradas</span>
                </Link>
                <div className="flex flex-col items-end gap-1">
                  <span className="num text-[15px] font-semibold">{brlShort(h.valor)}</span>
                  {edita ? (
                    <BotaoAcao url="/api/cobrancas" corpo={{ contratoId: h.contrato.id }} aviso="Cobrança gerada" className="pill p-linha" >
                      Cobrar
                    </BotaoAcao>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      <Secao titulo="Próximos 3 meses">
        <div className="card">
          <div className="linha block text-[15px] leading-[22px]">
            Para pagar a Casa e as contas da Clados, você precisa faturar <b>{brlShort(c.necessario)}/mês</b>. São {brlShort(fixasAno)} no ano,{" "}
            {dentroMei ? "dentro do limite do MEI." : <span className="text-vermelho">acima do limite do MEI.</span>}
          </div>
          {c.proximos.map((p) => (
            <div key={p.mes} className="linha block">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-medium">{monthTitle(p.mes)}</span>
                <span className="num text-[15px]">
                  <b>{brlShort(p.contratado)}</b> <span className="text-cinza">contratado</span>
                </span>
              </div>
              <div className="mt-2">
                <Barra pct={c.necessario ? (p.contratado / c.necessario) * 100 : 100} />
              </div>
              <div className="mt-[6px] text-[13px]" style={{ color: p.falta > 0 ? "var(--color-vermelho)" : "var(--color-verde)" }}>
                {p.falta > 0 ? `Faltam ${brlShort(p.falta)} em projetos ou horas` : "Coberto pelo que já está contratado"}
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="MEI">
        <div className="card">
          {c.das ? (
            <div className="linha">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "var(--color-fundo)" }}>
                <Icone nome="doc" />
              </div>
              <div className="flex-1">
                <span className="t1">DAS · vence {ddmm(c.das.vencimento)}</span>
                <span className="t2">Valor fixo do MEI</span>
              </div>
              <span className="num text-[15px] font-semibold">{brl(c.das.valor)}</span>
            </div>
          ) : null}
          <div className="linha block">
            <div className="flex items-baseline justify-between text-[15px]">
              <span>Faturado em {mes.slice(0, 4)}</span>
              <span className="num">
                <b>{brlShort(c.mei.faturado)}</b> de {brlShort(c.mei.limite)}
              </span>
            </div>
            <div className="mt-2">
              <Barra pct={c.mei.percentual} cor={c.mei.alerta ? "var(--color-vermelho)" : "var(--color-mata)"} />
            </div>
            {c.mei.alerta ? <div className="mt-[6px] text-[13px] text-vermelho">Passou de 80% do limite do MEI. Vale falar com a contabilidade.</div> : null}
          </div>
        </div>
        <div className="card mt-3">
          <LinhaLink href="/clados/contas">
            <div className="flex-1">
              <span className="t1">Contas fixas da Clados</span>
              <span className="t2">Ferramentas, DAS e parcelas</span>
            </div>
            <span className="num text-[15px] font-semibold">{brlShort(c.fixasMes)}/mês</span>
          </LinhaLink>
        </div>
      </Secao>
    </>
  );
}
