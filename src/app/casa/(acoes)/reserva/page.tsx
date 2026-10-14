import { and, desc, eq, inArray } from "drizzle-orm";
import { Cabecalho, Grande, Secao, Barra } from "@/components/ui";
import { lancamentos } from "@/db/schema";
import { ddmm } from "@/lib/dates";
import { brlShort, signed } from "@/lib/money";
import { mesCasa } from "@/server/casa";
import { exigirEdicao } from "@/server/sessao";
import { monthOf } from "@/lib/dates";
import { FormReserva } from "./form";

export const metadata = { title: "Reserva · Casa" };

export default async function Reserva() {
  const s = await exigirEdicao("casa");
  const m = await mesCasa(s.db, monthOf(s.hoje), s.hoje);
  const meta = m.resumo.precisa * 3;
  const hist = await s.db
    .select()
    .from(lancamentos)
    .where(and(eq(lancamentos.espacoId, m.espaco.id), inArray(lancamentos.tipo, ["guardar", "resgatar"])))
    .orderBy(desc(lancamentos.data), desc(lancamentos.id))
    .limit(20);
  return (
    <>
      <Cabecalho titulo="Reserva" sub="Casa" voltar="/casa" />
      <section className="px-4 pt-5">
        <div className="text-[13px] text-cinza">Guardado</div>
        <Grande valor={m.reserva} />
        <div className="mt-3 flex justify-between text-[13px] text-cinza">
          <span>Meta: 3 meses de contas</span>
          <span className="num">{brlShort(meta)}</span>
        </div>
        <div className="mt-2">
          <Barra pct={meta ? (m.reserva / meta) * 100 : 0} cor="var(--color-mata)" />
        </div>
      </section>
      <FormReserva hoje={s.hoje} reserva={m.reserva} />
      <Secao titulo="Movimentos">
        {hist.length ? (
          <div className="card">
            {hist.map((l) => (
              <div key={l.id} className="linha">
                <span className="num w-11 shrink-0 text-[13px] text-cinza">{ddmm(l.data)}</span>
                <span className="t1 flex-1">{l.descricao}</span>
                <span className="num text-[15px] font-semibold" style={{ color: l.tipo === "guardar" ? "var(--color-verde)" : undefined }}>
                  {signed(l.tipo === "guardar" ? l.valor : -l.valor)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card px-4 py-4 text-[14px] text-cinza">Nada guardado ainda. A conta “Guardar na reserva” e as sobras do fechamento aparecem aqui.</div>
        )}
      </Secao>
    </>
  );
}
