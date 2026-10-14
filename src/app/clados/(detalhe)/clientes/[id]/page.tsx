import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { BotaoAcao } from "@/components/acao";
import { Icone } from "@/components/icones";
import { Avatar, Barra, Cabecalho, Secao, iniciais } from "@/components/ui";
import { clientes, horas, lancamentos } from "@/db/schema";
import { formatHoras, valorHoras } from "@/domain/clados";
import { ddmm, monthYearShort } from "@/lib/dates";
import { brlShort, signed } from "@/lib/money";
import { linkWhatsApp, mensagemCobranca } from "@/lib/whatsapp";
import { listaClientes } from "@/server/clados";
import { exigirSessao } from "@/server/sessao";
import { CopiarMensagem } from "./copiar";

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigirSessao("clados");
  const id = Number((await params).id);
  const [[cli], lista, todasHoras, recebidos] = await Promise.all([
    s.db.select().from(clientes).where(eq(clientes.id, id)),
    listaClientes(s.db, s.hoje),
    s.db.select().from(horas).orderBy(desc(horas.data)),
    s.db.select().from(lancamentos).where(and(eq(lancamentos.clienteId, id), eq(lancamentos.tipo, "entrada"))).orderBy(desc(lancamentos.data)),
  ]);
  if (!cli) notFound();
  const info = lista.find((c) => c.cliente.id === id)!;
  const edita = s.acesso.clados === "edita";

  const atrasado = info.recebiveis.find((r) => !r.recebidoEm && r.vencimento < s.hoje);
  const contratoHora = info.contratos.find((k) => k.tipo === "hora");
  const horasAbertas = contratoHora ? todasHoras.filter((h) => h.contratoId === contratoHora.id && !h.recebivelId) : [];
  const minAbertos = horasAbertas.reduce((a, h) => a + h.minutos, 0);
  const msg = atrasado
    ? mensagemCobranca(cli.nome, atrasado.descricao, atrasado.valor, atrasado.vencimento)
    : contratoHora && minAbertos
      ? mensagemCobranca(cli.nome, `${formatHoras(minAbertos)} de ${contratoHora.descricao}`, valorHoras(minAbertos, contratoHora.valorHora ?? 0))
      : null;

  const historico = [
    ...recebidos.map((l) => ({ data: l.data, titulo: l.descricao.replace(`${cli.nome} · `, ""), sub: "Recebido", valor: <span className="text-verde">{signed(l.valor)}</span> })),
    ...todasHoras
      .filter((h) => info.contratos.some((k) => k.id === h.contratoId))
      .map((h) => {
        const k = info.contratos.find((x) => x.id === h.contratoId)!;
        return { data: h.data, titulo: `${formatHoras(h.minutos)} · ${h.descricao}`, sub: h.recebivelId ? "Horas cobradas" : "Horas registradas", valor: <span className="text-cinza">{brlShort(valorHoras(h.minutos, k.valorHora ?? 0))}</span> };
      }),
  ].sort((a, b) => (a.data < b.data ? 1 : -1));

  return (
    <>
      <Cabecalho
        titulo=""
        voltar="/clados/clientes"
        direita={
          cli.telefone ? (
            <a href={linkWhatsApp(cli.telefone, msg ?? `Olá, ${cli.nome.split(" ")[0]}!`)} target="_blank" rel="noreferrer" className="pill p-linha" style={{ height: 40 }}>
              <Icone nome="msg" tam={16} /> WhatsApp
            </a>
          ) : null
        }
      />
      <div className="mt-4 flex items-center gap-4 px-4">
        <Avatar texto={iniciais(cli.nome)} tam={56} />
        <div>
          <h1 className="m-0 text-[24px] font-semibold tracking-[-0.5px]">{cli.nome}</h1>
          <div className="text-[13px] text-cinza">Cliente desde {monthYearShort(cli.desde.slice(0, 7))}</div>
        </div>
      </div>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-[10px]">
        <div className="card p-4">
          <div className="text-[13px] text-cinza">Recebido no ano</div>
          <div className="num text-[22px] font-semibold">{brlShort(info.recebidoAno)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-cinza">Em aberto</div>
          <div className="num text-[22px] font-semibold" style={{ color: atrasado ? "var(--color-vermelho)" : "var(--color-verde)" }}>
            {brlShort(info.emAberto)}
          </div>
        </div>
      </div>

      <Secao titulo="Contratos">
        <div className="card">
          {info.contratos.map((k) => {
            const recs = info.recebiveis.filter((r) => r.contratoId === k.id).sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
            if (k.tipo === "projeto") {
              const pago = recs.filter((r) => r.recebidoEm).reduce((a, r) => a + r.valor, 0);
              return (
                <div key={k.id} className="linha block">
                  <div className="flex items-center justify-between">
                    <span className="tag">Projeto fechado</span>
                    <span className="num text-[15px] font-semibold">{brlShort(k.valorTotal ?? 0)}</span>
                  </div>
                  <div className="mt-2 text-[16px] font-medium">{k.descricao}</div>
                  <div className="mt-3">
                    <Barra pct={k.valorTotal ? (pago / k.valorTotal) * 100 : 0} />
                  </div>
                  {recs.map((r) => (
                    <div key={r.id} className="mt-3 flex items-center gap-2 text-[14px]">
                      <span className={`check ${r.recebidoEm ? "on" : ""}`} style={{ width: 20, height: 20 }}>
                        {r.recebidoEm ? <Icone nome="check" tam={12} traco={3} /> : null}
                      </span>
                      <span className="flex-1">
                        {r.descricao} · {r.recebidoEm ? `${ddmm(r.recebidoEm)}${r.nf ? " · NF emitida" : ""}` : `prevista ${ddmm(r.vencimento)}`}
                      </span>
                      <span className="num">{brlShort(r.valor)}</span>
                    </div>
                  ))}
                </div>
              );
            }
            if (k.tipo === "hora") {
              const mins = horasAbertas.filter((h) => h.contratoId === k.id).reduce((a, h) => a + h.minutos, 0);
              return (
                <div key={k.id} className="linha block">
                  <div className="flex items-center justify-between">
                    <span className="tag">Por hora</span>
                    <span className="num text-[15px] font-semibold">{brlShort(k.valorHora ?? 0)}/h</span>
                  </div>
                  <div className="mt-2 text-[16px] font-medium">{k.descricao}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[14px] text-cinza">
                      {mins ? (
                        <>
                          {formatHoras(mins)} não cobradas · <b className="text-tinta">{brlShort(valorHoras(mins, k.valorHora ?? 0))}</b>
                        </>
                      ) : (
                        "Nada para cobrar agora"
                      )}
                    </span>
                    {edita && mins ? (
                      <BotaoAcao url="/api/cobrancas" corpo={{ contratoId: k.id }} aviso="Cobrança gerada" className="pill p-mata">
                        Gerar cobrança
                      </BotaoAcao>
                    ) : null}
                  </div>
                </div>
              );
            }
            const prox = recs.find((r) => !r.recebidoEm);
            return (
              <div key={k.id} className="linha block">
                <div className="flex items-center justify-between">
                  <span className="tag">Suporte mensal</span>
                  <span className="num text-[15px] font-semibold">{brlShort(k.mensalidade ?? 0)}/mês</span>
                </div>
                <div className="mt-2 text-[16px] font-medium">{k.descricao}</div>
                <div className="mt-1 text-[14px] text-cinza">
                  Todo dia {k.dia}
                  {prox ? (
                    <>
                      {" · "}
                      <span style={{ color: prox.vencimento < s.hoje ? "var(--color-vermelho)" : undefined }}>
                        {prox.vencimento < s.hoje ? `atrasado desde ${ddmm(prox.vencimento)}` : `próximo em ${ddmm(prox.vencimento)}`}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {edita ? (
          <Link href={`/clados/clientes/novo?cliente=${cli.id}`} className="btn p-linha mt-3" style={{ height: 46, fontSize: 15 }}>
            <Icone nome="plus" tam={16} /> Novo contrato
          </Link>
        ) : null}
      </Secao>

      {msg ? (
        <Secao titulo="Cobrar">
          <div className="card p-4">
            <div className="rounded-[12px] p-4 text-[15px] leading-[22px]" style={{ background: "var(--color-fundo)" }}>
              {msg}
            </div>
            <div className="mt-3 flex gap-2">
              {cli.telefone ? (
                <a href={linkWhatsApp(cli.telefone, msg)} target="_blank" rel="noreferrer" className="pill p-agua flex-1" style={{ height: 44 }}>
                  Enviar no WhatsApp
                </a>
              ) : null}
              <CopiarMensagem texto={msg} />
            </div>
          </div>
        </Secao>
      ) : null}

      {historico.length ? (
        <Secao titulo="Histórico">
          <div className="card">
            {historico.map((h, i) => (
              <div key={i} className="linha">
                <span className="num w-11 shrink-0 text-[13px] text-cinza">{ddmm(h.data)}</span>
                <div className="min-w-0 flex-1">
                  <span className="t1">{h.titulo}</span>
                  <span className="t2">{h.sub}</span>
                </div>
                <span className="num text-[15px] font-semibold">{h.valor}</span>
              </div>
            ))}
          </div>
        </Secao>
      ) : null}
      <div className="h-6" />
    </>
  );
}
