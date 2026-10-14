import Link from "next/link";
import { ListaContas } from "@/components/contas";
import { Icone } from "@/components/icones";
import { Topo } from "@/components/topo";
import { Avatar, Barra, Grande, LinhaLink, Secao } from "@/components/ui";
import { addMonths, ddmm, monthName, monthOf, monthTitle } from "@/lib/dates";
import { brl, brlShort } from "@/lib/money";
import { getFechamento } from "@/server/base";
import { mesCasa } from "@/server/casa";
import { itensContasCasa } from "@/server/casa-itens";
import { mesClados } from "@/server/clados";
import { exigirSessao, mesDaUrl } from "@/server/sessao";

export const metadata = { title: "Casa · Financeiro" };

export default async function InicioCasa({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const s = await exigirSessao("casa");
  const mes = mesDaUrl(await searchParams, s.hoje);
  const mesAnterior = addMonths(mes, -1);
  const pm = mesCasa(s.db, mes, s.hoje);
  const [m, clados, fechAnterior] = await Promise.all([
    pm,
    s.acesso.clados ? mesClados(s.db, mes, s.hoje, pm) : null,
    pm.then((x) => getFechamento(s.db, x.espaco.id, mesAnterior)),
  ]);
  const r = m.resumo;
  const edita = s.acesso.casa === "edita";
  const anteriorAberto = mesAnterior >= monthOf(m.espaco.dataInicio) && !fechAnterior && mes <= monthOf(s.hoje);
  const itens = itensContasCasa(m, s.hoje).filter((c) => !c.pago);
  const proximas = itens.slice(0, 3);
  const reservaMensal = m.contas.find((c) => c.tipo === "reserva");
  const pctEntrou = r.precisa ? (r.entrou / r.precisa) * 100 : 100;
  const terminou = mes < monthOf(s.hoje);

  return (
    <>
      <Topo ativo="casa" acesso={s.acesso} mes={mes} nome={s.user.name} />

      <section className="px-4 pt-4">
        <div className="text-[13px] text-cinza">Saldo na conta da Casa</div>
        <Grande valor={m.saldoConta} cor={m.saldoConta < 0 ? "var(--color-vermelho)" : undefined} />
      </section>

      {anteriorAberto ? (
        <Link href={`/casa/fechamento?m=${mesAnterior}`} className="card mx-4 mt-4 flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--color-agua)" }}>
          <Icone nome="calendar" />
          <span className="flex-1">
            <span className="t1">Fechar {monthName(mesAnterior)}</span>
            <span className="t2">Decida o que fazer com a sobra ou a falta</span>
          </span>
          <Icone nome="right" tam={18} className="text-cinza" />
        </Link>
      ) : null}

      <section className="mx-4 mt-5 rounded-[18px] p-5" style={{ background: "var(--color-mata)", color: "#fff" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-medium">{r.faltaEntrar > 0 ? `Falta entrar em ${monthName(mes)}` : `Sobra em ${monthName(mes)}`}</div>
            <div className="text-[13px]" style={{ color: "#a7c4ba" }}>
              Contas, faturas e reserva: {brlShort(r.precisa)}
            </div>
          </div>
          <div className="num text-[26px] font-semibold" style={{ color: "var(--color-agua)" }}>
            {brlShort(r.faltaEntrar > 0 ? r.faltaEntrar : r.resultado)}
          </div>
        </div>
        <div className="my-4 h-px" style={{ background: "rgba(255,255,255,.12)" }} />
        <div className="space-y-1 text-[14px]" style={{ color: "#cfe3dc" }}>
          <div className="flex justify-between">
            <span>Retiradas da Clados</span>
            <b className="num text-white">{brlShort(m.retiradas)}</b>
          </div>
          {m.outrasEntradas ? (
            <div className="flex justify-between">
              <span>Outras entradas</span>
              <b className="num text-white">{brlShort(m.outrasEntradas)}</b>
            </div>
          ) : null}
          {r.sobraAnterior ? (
            <div className="flex justify-between">
              <span>Sobra de {monthName(mesAnterior)}</span>
              <b className="num text-white">{brlShort(r.sobraAnterior)}</b>
            </div>
          ) : null}
        </div>
        <div className="mt-3 h-[6px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>
          <i className="block h-full rounded-full" style={{ width: `${Math.min(100, pctEntrou)}%`, background: "var(--color-agua)" }} />
        </div>
        {r.faltaAnterior ? (
          <div className="mt-3 text-[13px]" style={{ color: "#cfe3dc" }}>
            Inclui {brl(r.faltaAnterior)} que faltou em {monthName(mesAnterior)}.
          </div>
        ) : null}
        {clados && r.faltaEntrar > 0 && !terminou ? (
          <div className="aviso aviso-escuro mt-4">
            <span className="shrink-0" style={{ color: "var(--color-agua)" }}>
              <Icone nome="alert" tam={18} />
            </span>
            <span>
              A Clados pode mandar {brlShort(clados.podeRetirar)} hoje.
              {clados.podeRetirar >= r.faltaEntrar ? " Isso cobre o que falta." : <> Ainda ficariam faltando <b>{brlShort(r.faltaEntrar - clados.podeRetirar)}</b>.</>}
            </span>
          </div>
        ) : null}
        {clados ? (
          <Link href="/clados" className="btn p-agua mt-4">
            Ver na Clados
          </Link>
        ) : null}
      </section>

      <Link href="/casa/dia-de-pagar" className="card mx-4 mt-3 flex items-center gap-3 px-4 py-3">
        <Icone nome="calendar" />
        <span className="flex-1">
          <span className="t1">Dia de pagar</span>
          <span className="t2">
            Todo dia {m.espaco.diaPagar} · {itens.filter((c) => c.id).length} contas em aberto em {monthName(mes)}
          </span>
        </span>
        <Icone nome="right" tam={18} className="text-cinza" />
      </Link>

      <Secao titulo="Próximas contas">
        {proximas.length ? (
          <>
            <ListaContas itens={proximas} hoje={s.hoje} edita={edita} />
          </>
        ) : (
          <div className="card px-4 py-4 text-[15px]">Todas as contas de {monthName(mes)} estão pagas.</div>
        )}
        <Link href={`/casa/contas?m=${mes}`} className="mt-2 block py-2 text-center text-[15px] font-medium text-verde">
          Ver as {m.contas.length} contas
        </Link>
      </Secao>

      <Secao titulo={`Faturas que vencem em ${monthName(mes)}`}>
        <div className="card">
          {m.faturas.map((f) => (
            <Link key={f.cartao.id} href={`/casa/cartoes?c=${f.cartao.id}`} className="linha">
              <Avatar texto={f.cartao.sigla} cor={f.cartao.dono === "Dayane" ? "var(--color-agua)" : f.cartao.dono ? undefined : "var(--color-trilho)"} tam={36} />
              <div className="min-w-0 flex-1">
                <span className="t1">{f.cartao.nome}</span>
                <span className="t2">{f.total ? `Vence ${ddmm(f.vencimento)}${f.pagoEm ? " · paga" : ""}` : "Sem compras"}</span>
              </div>
              <span className="num text-[15px] font-semibold" style={{ color: f.pagoEm || !f.total ? "var(--color-cinza)" : undefined }}>
                {brl(f.total)}
              </span>
            </Link>
          ))}
        </div>
      </Secao>

      <section className="sec">
        <div className="card">
          <LinhaLink href="/casa/reserva">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "var(--color-fundo)" }}>
              <Icone nome="shield" />
            </div>
            <div className="flex-1">
              <span className="t1">Reserva</span>
              <span className="t2">{reservaMensal ? `Guardando ${brl(reservaMensal.valor)} por mês` : "Dinheiro guardado da Casa"}</span>
            </div>
            <span className="num text-[15px] font-semibold">{brlShort(m.reserva)}</span>
          </LinhaLink>
        </div>
        {terminou && !m.fechamento ? (
          <Link href={`/casa/fechamento?m=${mes}`} className="btn p-mata mt-4">
            Fechar {monthName(mes)}
          </Link>
        ) : null}
        {m.fechamento ? <p className="mt-3 text-center text-[13px] text-cinza">{monthTitle(mes)} já foi fechado.</p> : null}
      </section>
    </>
  );
}
