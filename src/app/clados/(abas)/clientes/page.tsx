import Link from "next/link";
import { Icone } from "@/components/icones";
import { TituloPagina, Vazio, Avatar, iniciais } from "@/components/ui";
import { brlShort } from "@/lib/money";
import { listaClientes } from "@/server/clados";
import { exigirSessao } from "@/server/sessao";

export const metadata = { title: "Clientes · Financeiro" };

const FILTROS = [
  ["todos", "Todos"],
  ["suporte", "Suporte"],
  ["projeto", "Projetos"],
  ["hora", "Por hora"],
] as const;

export default async function Clientes({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const s = await exigirSessao("clados");
  const { f = "todos" } = await searchParams;
  const lista = await listaClientes(s.db, s.hoje);
  const filtrada = f === "todos" ? lista : lista.filter((c) => c.contratos.some((k) => k.tipo === f));
  const emAberto = lista.reduce((a, c) => a + c.emAberto, 0);
  const suporte = lista.flatMap((c) => c.contratos).filter((k) => k.tipo === "suporte").reduce((a, k) => a + (k.mensalidade ?? 0), 0);
  const edita = s.acesso.clados === "edita";

  return (
    <>
      <TituloPagina
        titulo="Clientes"
        sub={
          <span className="num">
            <b className="text-tinta">{brlShort(emAberto)}</b> em aberto · <b className="text-verde">{brlShort(suporte)}/mês</b> de suporte
          </span>
        }
        direita={
          edita ? (
            <Link href="/clados/clientes/novo" className="redondo" aria-label="Novo cliente">
              <Icone nome="plus" tam={20} />
            </Link>
          ) : null
        }
      />
      <div className="rolagem mt-4 px-4">
        {FILTROS.map(([k, t]) => (
          <Link key={k} href={k === "todos" ? "/clados/clientes" : `/clados/clientes?f=${k}`} className={`chip ${f === k ? "on" : ""}`}>
            {t}
          </Link>
        ))}
      </div>
      <section className="mx-4 mt-2">
        {filtrada.length === 0 ? (
          <Vazio titulo="Nenhum cliente aqui" texto="Cadastre um cliente e o contrato dele pelo botão +." />
        ) : (
          <div className="card">
            {filtrada.map(({ cliente, contratos, emAberto, recebidoAno, recebiveis }) => {
              const atrasado = recebiveis.some((r) => !r.recebidoEm && r.vencimento < s.hoje);
              return (
                <Link key={cliente.id} href={`/clados/clientes/${cliente.id}`} className="linha items-start">
                  <Avatar texto={iniciais(cliente.nome)} />
                  <div className="min-w-0 flex-1">
                    <span className="t1">{cliente.nome}</span>
                    <div className="mt-1 flex flex-wrap gap-y-1">
                      {contratos.map((k) => (
                        <span key={k.id} className="tag">
                          {k.tipo === "suporte" ? `Suporte ${brlShort(k.mensalidade ?? 0)}/mês` : k.tipo === "hora" ? `${brlShort(k.valorHora ?? 0)}/h` : `Projeto ${brlShort(k.valorTotal ?? 0)}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[15px] font-semibold" style={{ color: atrasado ? "var(--color-vermelho)" : undefined }}>
                      {brlShort(emAberto)}
                    </div>
                    <div className="num text-[13px] text-cinza">{brlShort(recebidoAno)} no ano</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <p className="mx-[2px] mt-3 text-[13px] leading-[19px] text-cinza">Em aberto soma suportes vencidos, parcelas de projeto a receber e horas ainda não cobradas.</p>
      </section>
    </>
  );
}
