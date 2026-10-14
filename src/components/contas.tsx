"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { longDay } from "@/lib/dates";
import { brl, num } from "@/lib/money";
import { avisar, CampoValor, useEnviar } from "./form";
import { Icone } from "./icones";
import { DiaMes } from "./ui";

export interface ItemConta {
  id: number | null; // null = linha só informativa
  vencimento: string;
  nome: string;
  sub: string;
  valor: number;
  pago: boolean;
  podeMarcar: boolean;
  atrasada?: boolean;
}

export function ListaContas({ itens, hoje, edita }: { itens: ItemConta[]; hoje: string; edita: boolean }) {
  const [aberta, setAberta] = useState<ItemConta | null>(null);
  const router = useRouter();
  // O check muda na hora; a tela confirma quando o servidor responde. Se der erro, volta como estava.
  const [marcadas, setMarcadas] = useState<Record<number, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
  // Quando a tela chega do servidor, some com o que ela já confirma (as que ainda estão indo continuam).
  useEffect(() => {
    setMarcadas((m) => {
      const resto = Object.fromEntries(Object.entries(m).filter(([id, pago]) => itens.find((x) => x.id === Number(id))?.pago !== pago));
      return Object.keys(resto).length === Object.keys(m).length ? m : resto;
    });
  }, [itens]);

  async function alternar(c: ItemConta) {
    const id = c.id!;
    const pago = !(marcadas[id] ?? c.pago);
    setErro(null);
    setMarcadas((m) => ({ ...m, [id]: pago }));
    try {
      const r = await fetch(pago ? "/api/contas/pagar" : "/api/contas/desmarcar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pago ? { id, data: hoje } : { id }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "Não deu certo. Tente de novo.");
      avisar(pago ? `${c.nome} paga` : "Conta desmarcada");
      router.refresh();
    } catch (e) {
      setMarcadas((m) => {
        const { [id]: _, ...resto } = m;
        return resto;
      });
      setErro(e instanceof TypeError ? "Sem conexão. Tente de novo." : (e as Error).message);
    }
  }

  return (
    <>
      {erro ? (
        <div className="aviso aviso-vermelho mb-3" role="alert">
          {erro}
        </div>
      ) : null}
      <div className="card">
        {itens.map((x, i) => ({ ...x, pago: x.id != null && marcadas[x.id] !== undefined ? marcadas[x.id] : x.pago, i })).map(({ i, ...c }) => (
          <div key={c.id ?? `v${i}`} className="linha">
            <DiaMes data={c.vencimento} apagado={c.pago} />
            <button type="button" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left" disabled={!c.id || !edita || !c.podeMarcar} onClick={() => setAberta(c)}>
              <span className="t1" style={{ color: c.pago ? "var(--color-cinza)" : undefined }}>
                {c.nome}
              </span>
              <span className="t2" style={{ color: c.atrasada ? "var(--color-vermelho)" : undefined }}>
                {c.sub}
              </span>
            </button>
            <span className="num shrink-0 text-[15px] font-medium" style={{ color: c.pago ? "var(--color-cinza)" : undefined }}>
              {num(c.valor)}
            </span>
            {c.id && c.podeMarcar && edita ? (
              <button
                type="button"
                className={`check ${c.pago ? "on" : ""}`}
                aria-label={c.pago ? `Desmarcar ${c.nome}` : `Marcar ${c.nome} como paga`}
                onClick={() => alternar(c)}
              >
                {c.pago ? <Icone nome="check" tam={15} traco={2.6} /> : null}
              </button>
            ) : (
              <span className={`check ${c.pago ? "on" : ""}`} style={{ opacity: c.pago ? 1 : 0.4 }} aria-hidden="true">
                {c.pago ? <Icone nome="check" tam={15} traco={2.6} /> : null}
              </span>
            )}
          </div>
        ))}
      </div>
      {aberta ? <FolhaConta conta={aberta} hoje={hoje} fechar={() => setAberta(null)} /> : null}
    </>
  );
}

function FolhaConta({ conta, hoje, fechar }: { conta: ItemConta; hoje: string; fechar: () => void }) {
  const [valor, setValor] = useState(conta.valor);
  const { enviar, enviando, erro } = useEnviar();
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={conta.nome}>
      <button type="button" aria-label="Fechar" onClick={fechar} className="absolute inset-0 border-0" style={{ background: "rgba(15,23,20,.45)" }} />
      <div className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[24px] px-4 pt-4" style={{ background: "var(--color-fundo)", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[20px] font-semibold tracking-[-0.4px]">{conta.nome}</div>
            <div className="text-[14px] text-cinza">
              Vence em {longDay(conta.vencimento)} · {conta.sub}
            </div>
          </div>
          <button type="button" onClick={fechar} className="redondo" aria-label="Fechar">
            <Icone nome="x" tam={16} />
          </button>
        </div>
        {conta.pago ? (
          <>
            <div className="num mt-4 text-[32px] font-medium">{brl(conta.valor)}</div>
            <p className="text-[14px] text-cinza">Já está paga.</p>
            <button type="button" className="btn p-linha mt-5" disabled={enviando} onClick={async () => (await enviar("/api/contas/desmarcar", { id: conta.id }, { aviso: "Conta desmarcada" })) && fechar()}>
              Desmarcar como paga
            </button>
          </>
        ) : (
          <>
            <CampoValor valor={valor} onChange={setValor} rotulo="Valor desta vez" autoFocus={false} />
            {erro ? (
              <div className="aviso aviso-vermelho mt-3" role="alert">
                {erro}
              </div>
            ) : null}
            <button type="button" className="btn p-mata mt-5" disabled={enviando || !valor} onClick={async () => (await enviar("/api/contas/pagar", { id: conta.id, valor, data: hoje }, { aviso: `${conta.nome} paga` })) && fechar()}>
              Paguei {brl(valor)} hoje
            </button>
            <button type="button" className="btn p-linha mt-[10px]" disabled={enviando || !valor || valor === conta.valor} onClick={async () => (await enviar("/api/contas/ajustar", { id: conta.id, valor }, { aviso: "Valor atualizado" })) && fechar()}>
              Só atualizar o valor previsto
            </button>
          </>
        )}
      </div>
    </div>
  );
}
