import { eq } from "drizzle-orm";
import { Cabecalho } from "@/components/ui";
import { clientes } from "@/db/schema";
import { exigirEdicao } from "@/server/sessao";
import { FormNovoCliente } from "./form";

export const metadata = { title: "Novo cliente · Clados" };

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const s = await exigirEdicao("clados");
  const id = Number((await searchParams).cliente);
  const [cli] = id ? await s.db.select().from(clientes).where(eq(clientes.id, id)) : [];
  return (
    <>
      <Cabecalho titulo={cli ? "Novo contrato" : "Novo cliente"} sub={cli ? cli.nome : "Cliente e contrato"} voltar={cli ? `/clados/clientes/${cli.id}` : "/clados/clientes"} />
      <FormNovoCliente cliente={cli ? { id: cli.id, nome: cli.nome } : null} hoje={s.hoje} />
    </>
  );
}
