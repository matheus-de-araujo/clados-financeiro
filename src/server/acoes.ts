import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { clientes, contasFixas, contasMes, contratos, faturas, fechamentos, horas, lancamentos, recebiveis } from "@/db/schema";
import { carregaParaProximo, dizimoSugerido, opcoesFechamento, type DecisaoFechamento } from "@/domain/casa";
import { diferencaConferencia, fechamentoDaFatura, mesDaFatura, planejarCompra, vencimentoDaFatura } from "@/domain/cartao";
import { valorHoras } from "@/domain/clados";
import { addMonths, lastDay, monthOf, type ISODate, type MonthKey } from "@/lib/dates";
import { sum, type Cents } from "@/lib/money";
import { ErroDeNegocio, getCartao, getEspaco, getEspacoById, saldoReserva, type TipoEspaco } from "./base";
import { faturaDoMes, mesCasa } from "./casa";
import { gerarMes } from "./gerar";

type Tx = DB;
const tx = <T>(db: DB, fn: (t: Tx) => Promise<T>) => db.transaction((t) => fn(t as unknown as Tx));

function positivo(v: Cents, campo = "Valor") {
  if (!Number.isInteger(v) || v <= 0) throw new ErroDeNegocio(`${campo} precisa ser maior que zero`);
}

// ---------- Clados ----------

export interface RecebimentoInput {
  recebivelId?: number | null;
  valor: Cents;
  data: ISODate;
  descricao?: string;
  nf?: boolean;
}

/** Cliente pagou: entra na conta da Clados e baixa o recebível. */
export async function registrarRecebimento(db: DB, i: RecebimentoInput, userId?: string) {
  positivo(i.valor);
  const clados = await getEspaco(db, "clados");
  return tx(db, async (t) => {
    let descricao = i.descricao?.trim() || "Recebimento";
    let clienteId: number | null = null;
    if (i.recebivelId) {
      const [r] = await t.select({ r: recebiveis, cliente: clientes }).from(recebiveis).innerJoin(clientes, eq(clientes.id, recebiveis.clienteId)).where(eq(recebiveis.id, i.recebivelId));
      if (!r) throw new ErroDeNegocio("Cobrança não encontrada", 404);
      if (r.r.recebidoEm) throw new ErroDeNegocio("Essa cobrança já foi recebida");
      descricao = `${r.cliente.nome} · ${r.r.descricao}`;
      clienteId = r.cliente.id;
    }
    const [l] = await t
      .insert(lancamentos)
      .values({ espacoId: clados.id, tipo: "entrada", valor: i.valor, data: i.data, descricao, recebivelId: i.recebivelId ?? null, clienteId, criadoPor: userId })
      .returning();
    if (i.recebivelId) {
      await t.update(recebiveis).set({ recebidoEm: i.data, nf: !!i.nf, lancamentoId: l.id }).where(eq(recebiveis.id, i.recebivelId));
    }
    return l;
  });
}

/** Retirada: sai da Clados e entra na Casa como renda. */
export async function registrarRetirada(db: DB, i: { valor: Cents; data: ISODate }, userId?: string) {
  positivo(i.valor);
  const clados = await getEspaco(db, "clados");
  const casa = await getEspaco(db, "casa");
  return tx(db, async (t) => {
    const [saida] = await t.insert(lancamentos).values({ espacoId: clados.id, tipo: "retirada", valor: i.valor, data: i.data, descricao: "Retirada", criadoPor: userId }).returning();
    const [entrada] = await t
      .insert(lancamentos)
      .values({ espacoId: casa.id, tipo: "entrada", valor: i.valor, data: i.data, descricao: "Retirada da Clados", retiradaId: saida.id, criadoPor: userId })
      .returning();
    return { saida, entrada };
  });
}

export async function registrarHoras(db: DB, i: { contratoId: number; minutos: number; descricao: string; data: ISODate; gerarCobranca?: boolean }, hoje: ISODate) {
  if (!Number.isInteger(i.minutos) || i.minutos <= 0) throw new ErroDeNegocio("Informe o tempo trabalhado");
  const [c] = await db.select().from(contratos).where(eq(contratos.id, i.contratoId));
  if (!c || c.tipo !== "hora") throw new ErroDeNegocio("Contrato por hora não encontrado", 404);
  const [h] = await db.insert(horas).values({ contratoId: c.id, data: i.data, minutos: i.minutos, descricao: i.descricao.trim() || "Manutenção" }).returning();
  if (i.gerarCobranca) await gerarCobrancaHoras(db, c.id, hoje);
  return h;
}

/** Junta as horas não cobradas do contrato numa cobrança. */
export async function gerarCobrancaHoras(db: DB, contratoId: number, hoje: ISODate) {
  const [c] = await db.select().from(contratos).where(eq(contratos.id, contratoId));
  if (!c) throw new ErroDeNegocio("Contrato não encontrado", 404);
  const abertas = await db.select().from(horas).where(and(eq(horas.contratoId, contratoId), isNull(horas.recebivelId)));
  if (abertas.length === 0) throw new ErroDeNegocio("Não há horas para cobrar");
  const minutos = sum(abertas.map((h) => h.minutos));
  const hh = Math.floor(minutos / 60);
  const mm = minutos % 60;
  return tx(db, async (t) => {
    const [r] = await t
      .insert(recebiveis)
      .values({
        contratoId: c.id,
        clienteId: c.clienteId,
        descricao: `Cobrança de ${hh}h${mm ? ` ${String(mm).padStart(2, "0")}` : ""} de ${c.descricao.toLowerCase()}`,
        valor: valorHoras(minutos, c.valorHora ?? 0),
        vencimento: hoje,
      })
      .returning();
    await t.update(horas).set({ recebivelId: r.id }).where(inArray(horas.id, abertas.map((h) => h.id)));
    return r;
  });
}

export interface ClienteInput {
  nome: string;
  telefone?: string | null;
  desde: ISODate;
}

export async function criarCliente(db: DB, i: ClienteInput) {
  if (!i.nome.trim()) throw new ErroDeNegocio("Informe o nome do cliente");
  const [c] = await db.insert(clientes).values({ nome: i.nome.trim(), telefone: i.telefone || null, desde: i.desde }).returning();
  return c;
}

export type ContratoInput =
  | { clienteId: number; tipo: "projeto"; descricao: string; valorTotal: Cents; parcelas: { valor: Cents; vencimento: ISODate; descricao?: string }[] }
  | { clienteId: number; tipo: "hora"; descricao: string; valorHora: Cents }
  | { clienteId: number; tipo: "suporte"; descricao: string; mensalidade: Cents; dia: number; inicioMes: MonthKey };

export async function criarContrato(db: DB, i: ContratoInput) {
  if (!i.descricao.trim()) throw new ErroDeNegocio("Descreva o contrato");
  return tx(db, async (t) => {
    if (i.tipo === "projeto") {
      positivo(i.valorTotal, "Valor do projeto");
      if (i.parcelas.length === 0) throw new ErroDeNegocio("Informe ao menos uma parcela");
      if (sum(i.parcelas.map((p) => p.valor)) !== i.valorTotal) throw new ErroDeNegocio("As parcelas precisam somar o valor do projeto");
      const [c] = await t.insert(contratos).values({ clienteId: i.clienteId, tipo: "projeto", descricao: i.descricao.trim(), valorTotal: i.valorTotal }).returning();
      const n = i.parcelas.length;
      for (const [k, p] of i.parcelas.entries()) {
        await t.insert(recebiveis).values({
          contratoId: c.id,
          clienteId: i.clienteId,
          descricao: p.descricao || (n > 1 ? `${i.descricao.trim()} · parcela ${k + 1} de ${n}` : i.descricao.trim()),
          valor: p.valor,
          vencimento: p.vencimento,
          parcela: n > 1 ? k + 1 : null,
          parcelas: n > 1 ? n : null,
        });
      }
      return c;
    }
    if (i.tipo === "hora") {
      positivo(i.valorHora, "Valor da hora");
      const [c] = await t.insert(contratos).values({ clienteId: i.clienteId, tipo: "hora", descricao: i.descricao.trim(), valorHora: i.valorHora }).returning();
      return c;
    }
    positivo(i.mensalidade, "Mensalidade");
    const [c] = await t
      .insert(contratos)
      .values({ clienteId: i.clienteId, tipo: "suporte", descricao: i.descricao.trim(), mensalidade: i.mensalidade, dia: i.dia, inicioMes: i.inicioMes })
      .returning();
    return c;
  });
}

// ---------- Compras, entradas e contas ----------

export interface CompraInput {
  espaco: TipoEspaco;
  valor: Cents;
  data: ISODate;
  descricao: string;
  cartaoId?: number | null; // null = débito, Pix ou conta
  categoriaId?: number | null;
  parcelas?: number;
  repetir?: boolean; // vira conta fixa todo mês
  origem?: "manual" | "atalho" | "arquivo" | "sistema";
  mesFatura?: MonthKey; // força a fatura (usado na conferência)
}

/** Gastei / Paguei: no cartão vira compra (parcelada ou não); sem cartão sai direto da conta. */
export async function lancarCompra(db: DB, i: CompraInput, userId?: string) {
  positivo(i.valor);
  const espaco = await getEspaco(db, i.espaco);
  const descricao = i.descricao.trim() || "Compra";
  const n = i.parcelas ?? 1;
  return tx(db, async (t) => {
    let contaFixaId: number | null = null;
    if (i.repetir) {
      if (n > 1) throw new ErroDeNegocio("Uma conta que repete todo mês não pode ser parcelada");
      const [f] = await t
        .insert(contasFixas)
        .values({
          espacoId: espaco.id,
          nome: descricao,
          dia: Number(i.data.slice(8, 10)),
          valor: i.valor,
          cartaoId: i.cartaoId ?? null,
          categoriaId: i.categoriaId ?? null,
          forma: i.cartaoId ? null : "Débito ou Pix",
          inicioMes: monthOf(i.data),
        })
        .returning();
      contaFixaId = f.id;
    }
    if (!i.cartaoId) {
      if (n > 1) throw new ErroDeNegocio("Parcelamento só no cartão");
      if (contaFixaId) {
        // A conta fixa no débito vira conta do mês, já paga hoje.
        const [cm] = await t
          .insert(contasMes)
          .values({ espacoId: espaco.id, contaFixaId, mes: monthOf(i.data), nome: descricao, vencimento: i.data, valor: i.valor, forma: "Débito ou Pix", pagoEm: i.data, valorPago: i.valor })
          .returning();
        const [l] = await t
          .insert(lancamentos)
          .values({ espacoId: espaco.id, tipo: "saida", valor: i.valor, data: i.data, descricao, categoriaId: i.categoriaId ?? null, origem: i.origem ?? "manual", contaMesId: cm.id, criadoPor: userId })
          .returning();
        await t.update(contasMes).set({ lancamentoId: l.id }).where(eq(contasMes.id, cm.id));
        return [l];
      }
      const [l] = await t
        .insert(lancamentos)
        .values({ espacoId: espaco.id, tipo: "saida", valor: i.valor, data: i.data, descricao, categoriaId: i.categoriaId ?? null, origem: i.origem ?? "manual", criadoPor: userId })
        .returning();
      return [l];
    }
    const cartao = await getCartao(t, i.cartaoId);
    if (cartao.espacoId !== espaco.id) throw new ErroDeNegocio("Esse cartão é de outro espaço");
    const plano = planejarCompra(i.valor, n, i.data, cartao.diaFecha, cartao.diaVence);
    const grupo = n > 1 ? crypto.randomUUID() : null;
    const out = [];
    for (const p of plano) {
      const [l] = await t
        .insert(lancamentos)
        .values({
          espacoId: espaco.id,
          tipo: "compra",
          valor: p.valor,
          data: i.data,
          descricao,
          categoriaId: i.categoriaId ?? null,
          cartaoId: cartao.id,
          mesFatura: i.mesFatura ? addMonths(i.mesFatura, p.parcela - 1) : p.mesFatura,
          parcela: n > 1 ? p.parcela : null,
          parcelas: n > 1 ? n : null,
          grupo,
          origem: i.origem ?? "manual",
          contaFixaId,
          mesRef: contaFixaId ? monthOf(i.data) : null,
          criadoPor: userId,
        })
        .returning();
      out.push(l);
    }
    return out;
  });
}

/** Entrou (Casa): renda da Dayane ou outra entrada. */
export async function lancarEntrada(db: DB, i: { espaco?: TipoEspaco; valor: Cents; data: ISODate; descricao: string }, userId?: string) {
  positivo(i.valor);
  const espaco = await getEspaco(db, i.espaco ?? "casa");
  const [l] = await db
    .insert(lancamentos)
    .values({ espacoId: espaco.id, tipo: "entrada", valor: i.valor, data: i.data, descricao: i.descricao.trim() || "Entrada", criadoPor: userId })
    .returning();
  return l;
}

/** Valor sugerido ao pagar uma conta (o dízimo é 10% das retiradas do mês). */
export async function valorSugeridoConta(db: DB, contaMesId: number): Promise<Cents> {
  const [c] = await db.select().from(contasMes).where(eq(contasMes.id, contaMesId));
  if (!c) throw new ErroDeNegocio("Conta não encontrada", 404);
  if (c.tipo !== "dizimo") return c.valor;
  const m = await mesCasa(db, c.mes);
  return m.retiradas > 0 ? dizimoSugerido(m.retiradas, c.percentual ?? undefined) : m.resumo.dizimo;
}

/** Marca a conta como paga: sai da conta (ou vai para a reserva, se for "Guardar na reserva"). */
export async function pagarConta(db: DB, contaMesId: number, i: { valor?: Cents; data: ISODate }, userId?: string) {
  const [c] = await db.select().from(contasMes).where(eq(contasMes.id, contaMesId));
  if (!c) throw new ErroDeNegocio("Conta não encontrada", 404);
  if (c.pagoEm) throw new ErroDeNegocio("Essa conta já está paga");
  const valor = i.valor ?? (await valorSugeridoConta(db, contaMesId));
  positivo(valor);
  return tx(db, async (t) => {
    const [l] = await t
      .insert(lancamentos)
      .values({
        espacoId: c.espacoId,
        tipo: c.tipo === "reserva" ? "guardar" : "saida",
        valor,
        data: i.data,
        descricao: c.parcela ? `${c.nome} · ${c.parcela}/${c.parcelas}` : c.nome,
        contaMesId: c.id,
        criadoPor: userId,
      })
      .returning();
    await t.update(contasMes).set({ pagoEm: i.data, valorPago: valor, lancamentoId: l.id }).where(eq(contasMes.id, c.id));
    return l;
  });
}

export async function desmarcarConta(db: DB, contaMesId: number) {
  const [c] = await db.select().from(contasMes).where(eq(contasMes.id, contaMesId));
  if (!c || !c.pagoEm) return;
  await tx(db, async (t) => {
    if (c.lancamentoId) await t.delete(lancamentos).where(eq(lancamentos.id, c.lancamentoId));
    await t.update(contasMes).set({ pagoEm: null, valorPago: null, lancamentoId: null }).where(eq(contasMes.id, c.id));
  });
}

/** Conta avulsa num mês (sem repetir). */
export async function criarContaAvulsa(db: DB, i: { espaco: TipoEspaco; nome: string; valor: Cents; vencimento: ISODate }) {
  positivo(i.valor);
  const espaco = await getEspaco(db, i.espaco);
  const [c] = await db.insert(contasMes).values({ espacoId: espaco.id, mes: monthOf(i.vencimento), nome: i.nome.trim(), vencimento: i.vencimento, valor: i.valor }).returning();
  return c;
}

export interface ContaFixaInput {
  espaco: TipoEspaco;
  nome: string;
  dia: number;
  valor: Cents;
  tipo?: "normal" | "dizimo" | "reserva";
  percentual?: number | null;
  cartaoId?: number | null;
  categoriaId?: number | null;
  forma?: string | null;
  parcelaAtual?: number | null; // parcela que vence em inicioMes
  parcelasTotal?: number | null;
  inicioMes: MonthKey;
  fimMes?: MonthKey | null;
}

export async function criarContaFixa(db: DB, i: ContaFixaInput) {
  if (!i.nome.trim()) throw new ErroDeNegocio("Dê um nome para a conta");
  if (i.dia < 1 || i.dia > 31) throw new ErroDeNegocio("Dia inválido");
  if (i.tipo !== "dizimo") positivo(i.valor);
  const espaco = await getEspaco(db, i.espaco);
  const [f] = await db
    .insert(contasFixas)
    .values({
      espacoId: espaco.id,
      nome: i.nome.trim(),
      dia: i.dia,
      valor: i.valor,
      tipo: i.tipo ?? "normal",
      percentual: i.tipo === "dizimo" ? (i.percentual ?? 1000) : null,
      cartaoId: i.cartaoId ?? null,
      categoriaId: i.categoriaId ?? null,
      forma: i.forma ?? null,
      parcelaInicio: i.parcelasTotal ? (i.parcelaAtual ?? 1) : null,
      parcelasTotal: i.parcelasTotal ?? null,
      inicioMes: i.inicioMes,
      fimMes: i.fimMes ?? null,
    })
    .returning();
  await gerarMes(db, espaco, i.inicioMes);
  return f;
}

/** Atualiza o valor previsto de uma conta do mês que ainda não foi paga (ex.: energia que veio diferente). */
export async function ajustarConta(db: DB, contaMesId: number, valor: Cents) {
  positivo(valor);
  await db.update(contasMes).set({ valor }).where(and(eq(contasMes.id, contaMesId), isNull(contasMes.pagoEm)));
}

// ---------- Faturas ----------

/** Paguei a fatura: sai da conta do espaço do cartão o total das compras que vencem no mês. */
export async function pagarFatura(db: DB, i: { cartaoId: number; mes: MonthKey; data: ISODate }, userId?: string) {
  const cartao = await getCartao(db, i.cartaoId);
  const f = await faturaDoMes(db, cartao, i.mes);
  if (f.pagoEm) throw new ErroDeNegocio("Essa fatura já está paga");
  if (f.total <= 0) throw new ErroDeNegocio("Essa fatura não tem compras");
  return tx(db, async (t) => {
    const [l] = await t
      .insert(lancamentos)
      .values({ espacoId: cartao.espacoId, tipo: "fatura", valor: f.total, data: i.data, descricao: `Fatura ${cartao.nome}`, cartaoId: cartao.id, mesRef: i.mes, criadoPor: userId })
      .returning();
    await t
      .insert(faturas)
      .values({ cartaoId: cartao.id, mes: i.mes, vencimento: vencimentoDaFatura(i.mes, cartao.diaVence), pagoEm: i.data, valorPago: f.total, lancamentoId: l.id })
      .onConflictDoUpdate({ target: [faturas.cartaoId, faturas.mes], set: { pagoEm: i.data, valorPago: f.total, lancamentoId: l.id } });
    return l;
  });
}

export async function desfazerPagamentoFatura(db: DB, cartaoId: number, mes: MonthKey) {
  const [f] = await db.select().from(faturas).where(and(eq(faturas.cartaoId, cartaoId), eq(faturas.mes, mes)));
  if (!f?.pagoEm) return;
  await tx(db, async (t) => {
    if (f.lancamentoId) await t.delete(lancamentos).where(eq(lancamentos.id, f.lancamentoId));
    await t.update(faturas).set({ pagoEm: null, valorPago: null, lancamentoId: null }).where(eq(faturas.id, f.id));
  });
}

/**
 * Conferir com o app do banco. Guarda o total informado; se pedir, lança a diferença como "Sem categoria"
 * na mesma fatura. Devolve a diferença (positivo = faltava lançar).
 */
export async function conferirFatura(
  db: DB,
  i: { cartaoId: number; mes: MonthKey; totalNoBanco: Cents; data: ISODate; lancarDiferenca?: boolean },
  userId?: string,
) {
  const cartao = await getCartao(db, i.cartaoId);
  const f = await faturaDoMes(db, cartao, i.mes);
  const diferenca = diferencaConferencia(i.totalNoBanco, f.total);
  if (i.lancarDiferenca && diferenca > 0) {
    const espaco = await getEspacoById(db, cartao.espacoId);
    await lancarCompra(
      db,
      { espaco: espaco.tipo as TipoEspaco, valor: diferenca, data: i.data, descricao: "Diferença da conferência", cartaoId: cartao.id, mesFatura: i.mes },
      userId,
    );
  }
  await db
    .insert(faturas)
    .values({ cartaoId: cartao.id, mes: i.mes, vencimento: vencimentoDaFatura(i.mes, cartao.diaVence), conferidoValor: i.totalNoBanco, conferidoEm: i.data })
    .onConflictDoUpdate({ target: [faturas.cartaoId, faturas.mes], set: { conferidoValor: i.totalNoBanco, conferidoEm: i.data } });
  return { diferenca, lancado: f.total, fechamento: fechamentoDaFatura(i.mes, cartao.diaFecha, cartao.diaVence) };
}

/** Fatura aberta hoje: a primeira cujo fechamento ainda não passou. */
export function mesDaFaturaAberta(hoje: ISODate, diaFecha: number, diaVence: number): MonthKey {
  return mesDaFatura(hoje, diaFecha, diaVence);
}

// ---------- Reserva ----------

export async function movimentarReserva(db: DB, i: { acao: "guardar" | "resgatar"; valor: Cents; data: ISODate; descricao?: string }, userId?: string) {
  positivo(i.valor);
  const casa = await getEspaco(db, "casa");
  if (i.acao === "resgatar") {
    const r = await saldoReserva(db, casa);
    if (i.valor > r) throw new ErroDeNegocio("A reserva não tem esse valor");
  }
  const [l] = await db
    .insert(lancamentos)
    .values({
      espacoId: casa.id,
      tipo: i.acao,
      valor: i.valor,
      data: i.data,
      descricao: i.descricao ?? (i.acao === "guardar" ? "Guardado na reserva" : "Usado da reserva"),
      criadoPor: userId,
    })
    .returning();
  return l;
}

// ---------- Fechamento da Casa ----------

/**
 * Fecha o mês da Casa. Sobra: vai para a reserva ou fica na conta (vira entrada do mês seguinte).
 * Falta: sai da reserva ou vai para o mês seguinte como primeira conta.
 */
export async function fecharMes(db: DB, mes: MonthKey, decisao: DecisaoFechamento, userId?: string) {
  const casa = await getEspaco(db, "casa");
  const m = await mesCasa(db, mes);
  if (m.fechamento) throw new ErroDeNegocio("Esse mês já foi fechado");
  const anteriorAberto = await db
    .select()
    .from(fechamentos)
    .where(and(eq(fechamentos.espacoId, casa.id), eq(fechamentos.mes, addMonths(mes, -1))));
  if (mes > monthOf(casa.dataInicio) && anteriorAberto.length === 0) {
    throw new ErroDeNegocio("Feche o mês anterior primeiro");
  }
  const resultado = m.resumo.resultado;
  if (!opcoesFechamento(resultado).includes(decisao)) throw new ErroDeNegocio("Essa opção não vale para o resultado do mês");
  const data = lastDay(mes);
  return tx(db, async (t) => {
    if (decisao === "reserva" && resultado > 0) {
      await t.insert(lancamentos).values({ espacoId: casa.id, tipo: "guardar", valor: resultado, data, descricao: `Sobra de ${nomeMes(mes)}`, criadoPor: userId });
    }
    if (decisao === "resgatar" && resultado < 0) {
      const r = await saldoReserva(t, casa);
      if (-resultado > r) throw new ErroDeNegocio("A reserva não cobre a falta");
      await t.insert(lancamentos).values({ espacoId: casa.id, tipo: "resgatar", valor: -resultado, data, descricao: `Cobrir a falta de ${nomeMes(mes)}`, criadoPor: userId });
    }
    const [f] = await t
      .insert(fechamentos)
      .values({ espacoId: casa.id, mes, resultado, decisao, carrega: carregaParaProximo(resultado, decisao), fechadoPor: userId })
      .returning();
    return f;
  });
}

/** Reabre o último mês fechado (desfaz o movimento de reserva que o fechamento fez). */
export async function reabrirMes(db: DB, mes: MonthKey) {
  const casa = await getEspaco(db, "casa");
  const [prox] = await db.select().from(fechamentos).where(and(eq(fechamentos.espacoId, casa.id), eq(fechamentos.mes, addMonths(mes, 1))));
  if (prox) throw new ErroDeNegocio("Reabra primeiro o mês seguinte");
  await tx(db, async (t) => {
    await t
      .delete(lancamentos)
      .where(and(eq(lancamentos.espacoId, casa.id), eq(lancamentos.data, lastDay(mes)), inArray(lancamentos.tipo, ["guardar", "resgatar"]), sql`${lancamentos.descricao} like ${"%de " + nomeMes(mes)}`));
    await t.delete(fechamentos).where(and(eq(fechamentos.espacoId, casa.id), eq(fechamentos.mes, mes)));
  });
}

function nomeMes(mes: MonthKey) {
  return ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(mes.slice(5)) - 1];
}

// ---------- Excluir ----------

/** Exclui um lançamento (e as outras parcelas, se for parcelado). Desfaz os vínculos. */
export async function excluirLancamento(db: DB, id: number) {
  const [l] = await db.select().from(lancamentos).where(eq(lancamentos.id, id));
  if (!l) throw new ErroDeNegocio("Lançamento não encontrado", 404);
  if (l.tipo === "fatura") {
    if (l.cartaoId && l.mesRef) return desfazerPagamentoFatura(db, l.cartaoId, l.mesRef);
  }
  await tx(db, async (t) => {
    const ids = l.grupo ? (await t.select({ id: lancamentos.id }).from(lancamentos).where(eq(lancamentos.grupo, l.grupo))).map((r) => r.id) : [l.id];
    if (l.contaMesId) await t.update(contasMes).set({ pagoEm: null, valorPago: null, lancamentoId: null }).where(eq(contasMes.id, l.contaMesId));
    if (l.recebivelId) await t.update(recebiveis).set({ recebidoEm: null, lancamentoId: null }).where(eq(recebiveis.id, l.recebivelId));
    if (l.tipo === "retirada") await t.delete(lancamentos).where(eq(lancamentos.retiradaId, l.id));
    if (l.retiradaId) await t.delete(lancamentos).where(eq(lancamentos.id, l.retiradaId));
    await t.delete(lancamentos).where(inArray(lancamentos.id, ids));
  });
}

