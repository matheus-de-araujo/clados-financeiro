import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Cabecalho, Vazio } from "@/components/ui";
import { clientes, contratos } from "@/db/schema";
import { horasNaoCobradas } from "@/server/clados";
import { exigirEdicao } from "@/server/sessao";
import { FormTrabalhei } from "./form";

export const metadata = { title: "Trabalhei · Clados" };

export default async function Trabalhei() {
  const s = await exigirEdicao("clados");
  const rows = await s.db.select({ c: contratos, cliente: clientes }).from(contratos).innerJoin(clientes, eq(clientes.id, contratos.clienteId)).where(and(eq(contratos.tipo, "hora"), eq(contratos.ativo, true)));
  const abertas = await horasNaoCobradas(s.db);
  const opcoes = rows.map((r) => ({ id: r.c.id, cliente: r.cliente.nome, descricao: r.c.descricao, valorHora: r.c.valorHora ?? 0, minutosAbertos: abertas.find((a) => a.contrato.id === r.c.id)?.minutos ?? 0 }));
  return (
    <>
      <Cabecalho titulo="Trabalhei" sub="Registrar horas de manutenção" voltar="/clados" />
      {opcoes.length ? (
        <FormTrabalhei contratos={opcoes} hoje={s.hoje} />
      ) : (
        <div className="mx-4 mt-6">
          <Vazio titulo="Nenhum contrato por hora" texto="Crie um contrato por hora no cliente para registrar horas." acao={<Link className="pill p-mata" href="/clados/clientes/novo">Novo contrato</Link>} />
        </div>
      )}
    </>
  );
}
