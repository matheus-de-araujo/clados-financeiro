import Link from "next/link";
import { ListaContas } from "@/components/contas";
import { Icone } from "@/components/icones";
import { SeletorMes } from "@/components/topo";
import { Barra, TituloPagina } from "@/components/ui";
import { brl } from "@/lib/money";
import { mesCasa } from "@/server/casa";
import { itensContasCasa } from "@/server/casa-itens";
import { exigirSessao, mesDaUrl } from "@/server/sessao";

export const metadata = { title: "Contas da Casa · Financeiro" };

export default async function ContasCasa({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const s = await exigirSessao("casa");
  const mes = mesDaUrl(await searchParams, s.hoje);
  const m = await mesCasa(s.db, mes, s.hoje);
  const itens = itensContasCasa(m, s.hoje);
  const reais = itens.filter((i) => i.id);
  const pagas = reais.filter((i) => i.pago).length;
  const total = reais.reduce((a, i) => a + i.valor, 0);
  const edita = s.acesso.casa === "edita";
  return (
    <>
      <TituloPagina titulo="Contas" direita={<SeletorMes mes={mes} base="/casa/contas" />} />
      <div className="mx-4 mt-1 text-[14px] text-cinza">
        <b className="num text-tinta">{brl(total)}</b> no mês · {pagas} de {reais.length} pagas
      </div>
      <div className="mx-4 mt-2">
        <Barra pct={reais.length ? (pagas / reais.length) * 100 : 0} cor="var(--color-mata)" />
      </div>
      <section className="mx-4 mt-4">
        <ListaContas itens={itens} hoje={s.hoje} edita={edita} />
        <p className="mx-[2px] mt-3 text-[13px] leading-[19px] text-cinza">Toque no nome da conta para pagar com outro valor ou corrigir o previsto. As faturas dos cartões ficam na aba Cartões.</p>
        {edita ? (
          <Link href="/casa/contas/nova" className="btn p-linha mt-3" style={{ height: 46, fontSize: 15 }}>
            <Icone nome="plus" tam={16} /> Nova conta fixa
          </Link>
        ) : null}
      </section>
    </>
  );
}
