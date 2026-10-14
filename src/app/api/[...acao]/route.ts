import { executar } from "@/server/rotas";

export async function POST(req: Request, ctx: { params: Promise<{ acao: string[] }> }) {
  const { acao } = await ctx.params;
  return executar(acao.join("/"), req);
}
