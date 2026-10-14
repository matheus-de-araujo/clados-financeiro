import Link from "next/link";
import type { DB } from "@/db";
import { addDays, ddmm, monthName } from "@/lib/dates";
import { brl, num } from "@/lib/money";
import type { Cartao } from "@/server/base";
import { faturaEmFoco, proximasFaturas } from "@/server/cartao";
import { comprasDaFatura, porCategoria } from "@/server/casa";
import { BotaoAcao } from "./acao";
import { Icone } from "./icones";
import { Barra, Secao, Vazio } from "./ui";

export async function PainelCartao({ db, cartao, hoje, edita, modo }: { db: DB; cartao: Cartao; hoje: string; edita: boolean; modo: "compras" | "categorias" }) {
  const { fatura, estado } = await faturaEmFoco(db, cartao, hoje);
  const compras = await comprasDaFatura(db, cartao.id, fatura.mes);
  const cats = modo === "categorias" ? await porCategoria(db, cartao.id, fatura.mes) : [];
  const proximas = await proximasFaturas(db, cartao, fatura.mes);
  const usado = fatura.total + proximas.reduce((a, f) => a + f.total, 0);
  const titulo = estado === "paga" ? `Paga · vence ${ddmm(fatura.vencimento)}` : estado === "fechada" ? `Fechada · vence ${ddmm(fatura.vencimento)}` : "Fatura aberta";
  const maxCat = Math.max(1, ...cats.map((c) => c.valor));
  const ultimoDia = Number(addDays(fatura.fechamento, -1).slice(8, 10));

  return (
    <>
      <section className="mx-4 mt-4 rounded-[18px] p-5" style={{ background: "var(--color-mata)", color: "#fff" }}>
        <div className="flex items-center justify-between text-[12px]" style={{ color: "#a7c4ba" }}>
          <span className="font-medium tracking-[2px] uppercase">{titulo}</span>
          <span>
            Fecha {ddmm(fatura.fechamento)} · vence {ddmm(fatura.vencimento)}
          </span>
        </div>
        <div className="num mt-2 text-[36px] font-medium tracking-[-1px]">{brl(fatura.total)}</div>
        {cartao.dono ? <div className="mt-1 text-[14px]" style={{ color: "#cfe3dc" }}>Cartão {cartao.dono === "Clados" ? "da Clados" : `de ${cartao.dono}`}</div> : null}
        {cartao.limite ? (
          <>
            <div className="mt-4 h-[6px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>
              <i className="block h-full rounded-full" style={{ width: `${Math.min(100, (usado / cartao.limite) * 100)}%`, background: "var(--color-agua)" }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px]" style={{ color: "#cfe3dc" }}>
              <span className="num">Limite livre {brl(Math.max(0, cartao.limite - usado)).replace(/,\d\d$/, "")}</span>
              <span className="num">de {brl(cartao.limite).replace(/,\d\d$/, "")}</span>
            </div>
          </>
        ) : null}
        {estado === "paga" ? (
          <div className="btn mt-4" style={{ background: "rgba(255,255,255,.08)", color: "var(--color-agua)", height: 48 }}>
            <Icone nome="check" tam={18} /> Paga em {ddmm(fatura.pagoEm!)}
          </div>
        ) : edita && fatura.total > 0 ? (
          <div className="mt-4">
            <BotaoAcao
              url="/api/faturas/pagar"
              corpo={{ cartaoId: cartao.id, mes: fatura.mes, data: hoje }}
              aviso="Fatura paga"
              className="btn p-agua"
              confirmar={`Marcar a fatura de ${brl(fatura.total)} como paga hoje? Sai da conta ${cartao.dono === "Clados" ? "da Clados" : "da Casa"}.`}
            >
              Paguei a fatura
            </BotaoAcao>
          </div>
        ) : null}
      </section>

      {modo === "categorias" ? (
        <Link href={`/casa/cartoes/${cartao.id}/conferir`} className="card mx-4 mt-3 flex items-center gap-3 px-4 py-3">
          <Icone nome="check" tam={20} />
          <span className="flex-1">
            <span className="t1">Conferir com o app do banco</span>
            <span className="t2">{fatura.conferidoEm ? `Conferida em ${ddmm(fatura.conferidoEm)}` : "Compare o total e ache o que faltou lançar"}</span>
          </span>
          <Icone nome="right" tam={18} className="text-cinza" />
        </Link>
      ) : null}

      {modo === "categorias" ? (
        <Secao titulo="Por categoria">
          {cats.length ? (
            <div className="card px-4 py-1">
              {cats.map((c) => (
                <div key={c.nome} className="py-3">
                  <div className="flex justify-between text-[15px]">
                    <span>{c.nome}</span>
                    <span className="num font-semibold">{brl(c.valor)}</span>
                  </div>
                  <div className="mt-2">
                    <Barra pct={(c.valor / maxCat) * 100} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Vazio titulo="Nenhuma compra nesta fatura" />
          )}
        </Secao>
      ) : null}

      <Secao titulo="Compras nesta fatura">
        {compras.length ? (
          <div className="card">
            {compras.map(({ l, categoria }) => (
              <div key={l.id} className="linha">
                <span className="num w-11 shrink-0 text-[13px] text-cinza">{ddmm(l.data)}</span>
                <div className="min-w-0 flex-1">
                  <span className="t1 truncate">{l.descricao}</span>
                  <span className="t2">{l.parcela ? `Parcela ${l.parcela} de ${l.parcelas}` : l.contaFixaId ? "Todo mês" : (categoria ?? "Sem categoria")}</span>
                </div>
                <span className="num text-[15px] font-semibold">{num(l.valor)}</span>
              </div>
            ))}
          </div>
        ) : (
          <Vazio titulo="Nenhuma compra ainda" />
        )}
      </Secao>

      <Secao titulo="Próximas faturas">
        <div className="card">
          {proximas.map((f) => (
            <div key={f.mes} className="linha">
              <span className="flex-1 text-[15px]">Vence {ddmm(f.vencimento)}</span>
              <span className="num text-[15px] font-semibold">{brl(f.total)}</span>
            </div>
          ))}
        </div>
        <p className="mx-[2px] mt-3 text-[13px] leading-[19px] text-cinza">
          Compras até o dia {ultimoDia} entram na fatura que vence em {monthName(fatura.mes)}. A partir do dia {cartao.diaFecha}, vão para a próxima.
        </p>
      </Secao>
    </>
  );
}
