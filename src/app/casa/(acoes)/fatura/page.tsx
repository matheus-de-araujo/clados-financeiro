import Link from "next/link";
import { BotaoAcao } from "@/components/acao";
import { Avatar, Cabecalho } from "@/components/ui";
import { ddmm } from "@/lib/dates";
import { brl } from "@/lib/money";
import { getEspaco, listCartoes } from "@/server/base";
import { faturaEmFoco } from "@/server/cartao";
import { exigirEdicao } from "@/server/sessao";

export const metadata = { title: "Paguei a fatura · Casa" };

export default async function PagueiFatura() {
  const s = await exigirEdicao("casa");
  const casa = await getEspaco(s.db, "casa");
  const cartoes = await listCartoes(s.db, casa.id);
  const focos = await Promise.all(cartoes.map((c) => faturaEmFoco(s.db, c, s.hoje)));
  return (
    <>
      <Cabecalho titulo="Paguei a fatura" sub="Sai da conta da Casa o total da fatura" voltar="/casa" />
      <section className="sec">
        <div className="card">
          {focos.map(({ fatura: f, estado }) => (
            <div key={f.cartao.id} className="linha">
              <Avatar texto={f.cartao.sigla} cor={f.cartao.dono === "Dayane" ? "var(--color-agua)" : f.cartao.dono ? undefined : "var(--color-trilho)"} tam={36} />
              <Link href={`/casa/cartoes?c=${f.cartao.id}`} className="min-w-0 flex-1">
                <span className="t1">{f.cartao.nome}</span>
                <span className="t2">
                  {estado === "paga" ? `Paga em ${ddmm(f.pagoEm!)}` : `${estado === "fechada" ? "Fechada" : "Aberta"} · vence ${ddmm(f.vencimento)}`} · <span className="num">{brl(f.total)}</span>
                </span>
              </Link>
              {estado !== "paga" && f.total > 0 ? (
                <BotaoAcao url="/api/faturas/pagar" corpo={{ cartaoId: f.cartao.id, mes: f.mes, data: s.hoje }} aviso={`Fatura ${f.cartao.nome} paga`} className="pill p-mata" destino="/casa" confirmar={`Pagar ${brl(f.total)} do ${f.cartao.nome} hoje?`}>
                  Paguei
                </BotaoAcao>
              ) : null}
            </div>
          ))}
        </div>
        <p className="mx-[2px] mt-3 text-[13px] leading-[19px] text-cinza">Antes de pagar, vale conferir o total com o app do banco na aba Cartões.</p>
      </section>
    </>
  );
}
