import Link from "next/link";
import { ListaExtrato } from "./extrato";
import { SeletorMes } from "./topo";
import { TituloPagina, Vazio } from "./ui";
import { monthTitle, type MonthKey } from "@/lib/dates";
import { brlShort } from "@/lib/money";
import type { DB } from "@/db";
import type { Espaco } from "@/server/base";
import { itensExtrato } from "@/server/extrato";

export async function PaginaExtrato({ db, espaco, mes, filtro, filtros, hoje, edita }: { db: DB; espaco: Espaco; mes: MonthKey; filtro: string; filtros: { chave: string; texto: string; teste: (i: { tipo: string; cartaoId: number | null; retirada: boolean; valor: number; cartao: boolean }) => boolean }[]; hoje: string; edita: boolean }) {
  const { itens, entrou, saiu, noCartao } = await itensExtrato(db, espaco, mes);
  const f = filtros.find((x) => x.chave === filtro) ?? filtros[0];
  const lista = itens.filter(f.teste);
  const base = `/${espaco.tipo}/extrato`;
  return (
    <>
      <TituloPagina titulo="Extrato" direita={<SeletorMes mes={mes} base={base} />} />
      <div className="rolagem mt-4 px-4">
        {filtros.map((x) => (
          <Link key={x.chave} href={`${base}?m=${mes}${x.chave === "tudo" ? "" : `&f=${x.chave}`}`} className={`chip ${f.chave === x.chave ? "on" : ""}`}>
            {x.texto}
          </Link>
        ))}
      </div>
      <div className="mx-4 mt-1 text-[14px] leading-[20px] text-cinza">
        {monthTitle(mes)}: <b className="num text-verde">+{brlShort(entrou)}</b> entrou · <b className="num text-tinta">−{brlShort(saiu)}</b> saiu
        {noCartao ? <> · <span className="num">{brlShort(noCartao)}</span> no cartão</> : null}
      </div>
      {lista.length ? <ListaExtrato itens={lista} hoje={hoje} edita={edita} /> : <div className="mx-4 mt-4"><Vazio titulo="Nada por aqui" texto="Nenhum lançamento neste mês com esse filtro." /></div>}
    </>
  );
}
