import "server-only";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { lancamentos, membros, espacos, contasMes } from "@/db/schema";
import * as acoes from "./acoes";
import { ErroDeNegocio, getCartao, getEspacoById, type TipoEspaco } from "./base";
import { getSessao, type Sessao } from "./sessao";

const centavos = z.number({ error: "Informe o valor" }).int().positive("O valor precisa ser maior que zero").max(100_000_000_00);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido");
const id = z.number().int().positive();
const espaco = z.enum(["clados", "casa"]);

interface Rota<S extends z.ZodType> {
  esquema: S;
  espaco: TipoEspaco | ((i: z.infer<S>, s: Sessao) => Promise<TipoEspaco> | TipoEspaco);
  fazer: (i: z.infer<S>, s: Sessao) => Promise<unknown>;
}

function rota<S extends z.ZodType>(r: Rota<S>) {
  return r as unknown as Rota<z.ZodType>;
}

async function espacoDoCartao(s: Sessao, cartaoId: number): Promise<TipoEspaco> {
  const c = await getCartao(s.db, cartaoId);
  return (await getEspacoById(s.db, c.espacoId)).tipo as TipoEspaco;
}

async function espacoDoLancamento(s: Sessao, lid: number): Promise<TipoEspaco> {
  const [l] = await s.db.select().from(lancamentos).where(eq(lancamentos.id, lid));
  if (!l) throw new ErroDeNegocio("Lançamento não encontrado", 404);
  return (await getEspacoById(s.db, l.espacoId)).tipo as TipoEspaco;
}

async function espacoDaConta(s: Sessao, cid: number): Promise<TipoEspaco> {
  const [c] = await s.db.select().from(contasMes).where(eq(contasMes.id, cid));
  if (!c) throw new ErroDeNegocio("Conta não encontrada", 404);
  return (await getEspacoById(s.db, c.espacoId)).tipo as TipoEspaco;
}

export const ROTAS: Record<string, Rota<z.ZodType>> = {
  // Clados
  recebimentos: rota({
    esquema: z.object({ recebivelId: id.nullish(), valor: centavos, data, descricao: z.string().max(120).optional(), nf: z.boolean().optional() }),
    espaco: "clados",
    fazer: (i, s) => acoes.registrarRecebimento(s.db, i, s.user.id),
  }),
  retiradas: rota({
    esquema: z.object({ valor: centavos, data }),
    espaco: "clados",
    fazer: (i, s) => acoes.registrarRetirada(s.db, i, s.user.id),
  }),
  horas: rota({
    esquema: z.object({ contratoId: id, minutos: z.number().int().positive("Informe o tempo").max(24 * 60 * 31), descricao: z.string().max(200), data, gerarCobranca: z.boolean().optional() }),
    espaco: "clados",
    fazer: (i, s) => acoes.registrarHoras(s.db, i, s.hoje),
  }),
  cobrancas: rota({
    esquema: z.object({ contratoId: id }),
    espaco: "clados",
    fazer: (i, s) => acoes.gerarCobrancaHoras(s.db, i.contratoId, s.hoje),
  }),
  clientes: rota({
    esquema: z.object({ nome: z.string().min(1, "Informe o nome").max(120), telefone: z.string().max(30).nullish() }),
    espaco: "clados",
    fazer: (i, s) => acoes.criarCliente(s.db, { ...i, desde: s.hoje }),
  }),
  contratos: rota({
    esquema: z.discriminatedUnion("tipo", [
      z.object({ clienteId: id, tipo: z.literal("projeto"), descricao: z.string().min(1, "Descreva o contrato"), valorTotal: centavos, parcelas: z.array(z.object({ valor: centavos, vencimento: data, descricao: z.string().optional() })).min(1).max(24) }),
      z.object({ clienteId: id, tipo: z.literal("hora"), descricao: z.string().min(1, "Descreva o contrato"), valorHora: centavos }),
      z.object({ clienteId: id, tipo: z.literal("suporte"), descricao: z.string().min(1, "Descreva o contrato"), mensalidade: centavos, dia: z.number().int().min(1).max(31), inicioMes: mes }),
    ]),
    espaco: "clados",
    fazer: (i, s) => acoes.criarContrato(s.db, i),
  }),

  // Os dois espaços
  compras: rota({
    esquema: z.object({
      espaco,
      valor: centavos,
      data,
      descricao: z.string().max(120),
      cartaoId: id.nullish(),
      categoriaId: id.nullish(),
      parcelas: z.number().int().min(1).max(48).optional(),
      repetir: z.boolean().optional(),
    }),
    espaco: (i) => i.espaco,
    fazer: (i, s) => acoes.lancarCompra(s.db, i, s.user.id),
  }),
  entradas: rota({
    esquema: z.object({ valor: centavos, data, descricao: z.string().max(120) }),
    espaco: "casa",
    fazer: (i, s) => acoes.lancarEntrada(s.db, { ...i, espaco: "casa" }, s.user.id),
  }),
  "contas/pagar": rota({
    esquema: z.object({ id, valor: centavos.optional(), data }),
    espaco: (i, s) => espacoDaConta(s, i.id),
    fazer: (i, s) => acoes.pagarConta(s.db, i.id, i, s.user.id),
  }),
  "contas/desmarcar": rota({
    esquema: z.object({ id }),
    espaco: (i, s) => espacoDaConta(s, i.id),
    fazer: (i, s) => acoes.desmarcarConta(s.db, i.id),
  }),
  "contas/ajustar": rota({
    esquema: z.object({ id, valor: centavos }),
    espaco: (i, s) => espacoDaConta(s, i.id),
    fazer: (i, s) => acoes.ajustarConta(s.db, i.id, i.valor),
  }),
  "contas-fixas": rota({
    esquema: z.object({
      espaco,
      nome: z.string().min(1, "Dê um nome para a conta").max(80),
      dia: z.number().int().min(1).max(31),
      valor: z.number().int().min(0),
      tipo: z.enum(["normal", "dizimo", "reserva"]).optional(),
      cartaoId: id.nullish(),
      categoriaId: id.nullish(),
      forma: z.string().max(40).nullish(),
      parcelaAtual: z.number().int().min(1).nullish(),
      parcelasTotal: z.number().int().min(2).max(600).nullish(),
      inicioMes: mes,
    }),
    espaco: (i) => i.espaco,
    fazer: (i, s) => acoes.criarContaFixa(s.db, i),
  }),
  "faturas/pagar": rota({
    esquema: z.object({ cartaoId: id, mes, data }),
    espaco: (i, s) => espacoDoCartao(s, i.cartaoId),
    fazer: (i, s) => acoes.pagarFatura(s.db, i, s.user.id),
  }),
  "faturas/desfazer": rota({
    esquema: z.object({ cartaoId: id, mes }),
    espaco: (i, s) => espacoDoCartao(s, i.cartaoId),
    fazer: (i, s) => acoes.desfazerPagamentoFatura(s.db, i.cartaoId, i.mes),
  }),
  "faturas/conferir": rota({
    esquema: z.object({ cartaoId: id, mes, totalNoBanco: z.number().int().min(0), lancarDiferenca: z.boolean().optional() }),
    espaco: (i, s) => espacoDoCartao(s, i.cartaoId),
    fazer: (i, s) => acoes.conferirFatura(s.db, { ...i, data: s.hoje }, s.user.id),
  }),
  reserva: rota({
    esquema: z.object({ acao: z.enum(["guardar", "resgatar"]), valor: centavos, data }),
    espaco: "casa",
    fazer: (i, s) => acoes.movimentarReserva(s.db, i, s.user.id),
  }),
  fechamentos: rota({
    esquema: z.object({ mes, decisao: z.enum(["reserva", "conta", "resgatar", "proximo"]) }),
    espaco: "casa",
    fazer: (i, s) => acoes.fecharMes(s.db, i.mes, i.decisao, s.user.id),
  }),
  "fechamentos/reabrir": rota({
    esquema: z.object({ mes }),
    espaco: "casa",
    fazer: (i, s) => acoes.reabrirMes(s.db, i.mes),
  }),
  "lancamentos/excluir": rota({
    esquema: z.object({ id }),
    espaco: (i, s) => espacoDoLancamento(s, i.id),
    fazer: (i, s) => acoes.excluirLancamento(s.db, i.id),
  }),
  membros: rota({
    esquema: z.object({ userId: z.string().min(1), espaco, papel: z.enum(["edita", "ve"]).nullable() }),
    espaco: "clados",
    fazer: async (i, s) => {
      if (i.userId === s.user.id) throw new ErroDeNegocio("Você não pode mudar o seu próprio acesso");
      const [e] = await s.db.select().from(espacos).where(eq(espacos.tipo, i.espaco));
      const atuais = await s.db.select().from(membros).where(eq(membros.userId, i.userId));
      const m = atuais.find((x) => x.espacoId === e.id);
      if (i.papel === null) {
        if (m) {
          if (atuais.length === 1) throw new ErroDeNegocio("A pessoa precisa ter acesso a pelo menos um espaço");
          await s.db.delete(membros).where(eq(membros.id, m.id));
        }
      } else if (m) await s.db.update(membros).set({ papel: i.papel }).where(eq(membros.id, m.id));
      else await s.db.insert(membros).values({ userId: i.userId, espacoId: e.id, papel: i.papel });
      return { ok: true };
    },
  }),
};

export async function executar(caminho: string, req: Request): Promise<Response> {
  const r = ROTAS[caminho];
  if (!r) return Response.json({ erro: "Não encontrado" }, { status: 404 });
  const s = await getSessao();
  if (!s) return Response.json({ erro: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: "Pedido inválido" }, { status: 400 });
  }
  const p = r.esquema.safeParse(corpo);
  if (!p.success) return Response.json({ erro: p.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  try {
    const esp = typeof r.espaco === "function" ? await r.espaco(p.data, s) : r.espaco;
    if (s.acesso[esp] !== "edita") return Response.json({ erro: "Você só pode ver este espaço" }, { status: 403 });
    const out = await r.fazer(p.data, s);
    return Response.json(out ?? { ok: true });
  } catch (e) {
    if (e instanceof ErroDeNegocio) return Response.json({ erro: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ erro: "Erro inesperado. Tente de novo." }, { status: 500 });
  }
}
