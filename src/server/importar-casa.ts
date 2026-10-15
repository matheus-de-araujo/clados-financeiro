// Importa as planilhas mensais da Casa (pasta do Drive) para dentro do app.
// Os dados ficam em src/db/planilhas/*.json, em centavos, um objeto por mês do app:
// a aba "08 - AGOSTO paga em SETEMBRO" vira o mês 2026-09.
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { cartoes, categorias, contasFixas, contasMes, espacos, faturas, fechamentos, lancamentos } from "@/db/schema";
import { CONTA_MEI, CONTA_RESERVA, CONTAS_CASA } from "@/db/planilha";
import { addDays, addMonths, dateInMonth, monthDiff, type ISODate, type MonthKey } from "@/lib/dates";
import { criarContaAvulsa, criarContaFixa, lancarCompra, lancarEntrada, pagarConta, pagarFatura } from "./acoes";
import { getEspaco } from "./base";
import { faturaDoMes, mesCasa } from "./casa";
import { gerarMeses } from "./gerar";
import { janelaDaFatura } from "./simulacao";
import fev from "@/db/planilhas/2026-02a04.json";
import mai from "@/db/planilhas/2026-05a07.json";
import ago from "@/db/planilhas/2026-08a11.json";

type Status = "PAGO" | "PENDENTE" | "AGENDADO";
export interface MesImportado {
  planilha: string;
  mes: MonthKey;
  entradas: [string, number][];
  contas: [string, number | null, Status, number][];
  cartoes: Record<string, { total: number; itens: [string, string, number][] }>;
  resultado: number;
}

export const MESES_IMPORTADOS = [...fev, ...mai, ...ago] as unknown as MesImportado[];
export const PRIMEIRO_MES = "2026-02";
/** A partir deste mês o cartão PJ e o DAS do MEI são da Clados, e o salário vem por retirada. */
export const MES_DA_SEPARACAO = "2026-11";

/** Cartão PJ antigo: ficava na Casa até a Clados assumir. Fica inativo, só para o histórico. */
export const CARTAO_PJ_CASA = { nome: "Cartão PJ", dono: "Matheus", sigla: "PJ", diaFecha: 30, diaVence: 6 };

const CARTAO_DA_ABA: Record<string, string> = {
  "NUBANK MATHEUS": "Nubank Matheus",
  "NUBANK DAYANE": "Nubank Dayane",
  "MERCADO PAGO": "Mercado Pago",
  "PJ MATHEUS": CARTAO_PJ_CASA.nome,
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/** Conta da planilha → chave da conta fixa do app (null = conta avulsa daquele mês). */
export function chaveDaConta(nome: string): string | null {
  const n = semAcento(nome);
  if (n.startsWith("MEI")) return "mei";
  if (n.startsWith("DIZIMO")) return "dizimo";
  if (n.startsWith("SEGURO")) return "seguro";
  if (n.startsWith("CONDOMINIO")) return "condominio";
  if (n.startsWith("TENDA")) return "tenda";
  if (n.startsWith("CASA CAIXA")) return "caixa";
  if (n.startsWith("ENERGIA")) return "energia";
  if (n.startsWith("INTERNET")) return "internet";
  if (n.startsWith("GAZ") || n.startsWith("GAS")) return "gas";
  if (n.startsWith("CARRO")) return "carro";
  if (n.startsWith("IRPF")) return "irpf";
  if (n.startsWith("UNIMED")) return "unimed";
  if (n.startsWith("PROVISAO")) return "reserva";
  return null;
}

/** Categoria do app para um item do cartão: pela categoria da planilha e, sem ela, pela descrição. */
export function categoriaDoItem(descricao: string, categoria: string): string | null {
  const c = semAcento(categoria);
  const d = semAcento(descricao);
  if (/UBER/.test(d)) return "Outros";
  const porCat: Record<string, string> = {
    ALIMENTACAO: "Supermercado",
    LAZER: "Jantar, lanches e lazer",
    GASOLINA: "Gasolina",
    TRANSPORTE: "Gasolina",
    FARMACIA: "Farmácia",
    SAUDE: "Farmácia",
    DESEJOS: "Desejos",
    ASSINATURA: "Assinaturas",
    CASA: "Casa",
    SOFIA: "Sofia",
    BEBE: "Sofia",
  };
  if (porCat[c]) return porCat[c];
  if (c) return "Outros";
  if (/SUPERM|MERCADO|SABAO/.test(d)) return "Supermercado";
  if (/FARMAC|CONSULTA/.test(d)) return "Farmácia";
  if (/GASOLINA|LAVA JATO/.test(d)) return "Gasolina";
  if (/JANTAR|LANCHE|LAZER/.test(d)) return "Jantar, lanches e lazer";
  if (/SOFIA|BB\b|CHA BB/.test(d)) return "Sofia";
  if (/PLANTAS|LUZES|CASA/.test(d)) return "Casa";
  if (
    /NETFLIX|YOUTUBE|^YT$|GOOGLE|WINDSURF|CURSOR|CLAUDE|GITHUB|AMAZON PRIME|SQSP|OFX|ACADEMIA|APPLE|CANVA|BAIXISTA|CHAT GPT|BOOSTEROID|BANDLAB|MOISES|EMAIL|FACEBOOK|RECARGA|PLANO CLARO|NUBANK \+|MELIMAIS|CAMSCANNER|CROWNBILL|TABEX|NUTAG|EDZ/.test(d)
  )
    return "Assinaturas";
  return null;
}

/** Nome mais legível para as entradas da planilha. */
export function nomeDaEntrada(desc: string): string {
  const d = semAcento(desc);
  if (d === "MATHEUS") return desc === "Matheus" ? "Matheus (extra)" : "Salário Matheus";
  if (d === "DAYANE") return "Dayane";
  if (d === "RESERVA") return "Tirado da reserva";
  if (d === "EM CAIXA") return "Sobra do mês anterior";
  if (d === "AJUSTE") return "Ajuste";
  if (d === "NUBANK") return "Nubank";
  if (d === "SOFIA") return "Sofia";
  return desc.trim();
}

function nomeDoItem(descricao: string, categoria: string): string {
  const d = descricao.trim();
  if (d === "PAGO") return "Pago antes do vencimento";
  if (d) return d;
  return categoria ? categoria.charAt(0) + categoria.slice(1).toLowerCase() : "Sem descrição";
}

export interface OpcoesImportacao {
  /** Data de hoje: o que vence depois fica previsto (contas) ou não é lançado (salário). */
  hoje: ISODate;
  /** Saldo da conta da Casa no início de fevereiro de 2026. */
  saldoInicial?: number;
  /** Reserva da Casa no início de fevereiro de 2026. */
  reservaInicial?: number;
  /**
   * Contas que a planilha deixou como PENDENTE em meses que já passaram: true marca como pagas no vencimento
   * (a planilha quase nunca era atualizada depois), false deixa em aberto.
   */
  pendentesPassadasComoPagas?: boolean;
  meses?: MesImportado[];
}

/**
 * Apaga tudo o que é da Casa (lançamentos, contas, faturas e fechamentos), menos as retiradas que vieram
 * da Clados, os cartões e as categorias. A Clados e os usuários não mudam.
 */
export async function limparCasa(db: DB) {
  const casa = await getEspaco(db, "casa");
  const ids = (await db.select({ id: cartoes.id }).from(cartoes).where(eq(cartoes.espacoId, casa.id))).map((c) => c.id);
  await db.transaction(async (t) => {
    if (ids.length) await t.delete(faturas).where(inArray(faturas.cartaoId, ids));
    await t.delete(lancamentos).where(and(eq(lancamentos.espacoId, casa.id), isNull(lancamentos.retiradaId)));
    await t.delete(contasMes).where(eq(contasMes.espacoId, casa.id));
    await t.delete(contasFixas).where(eq(contasFixas.espacoId, casa.id));
    await t.delete(fechamentos).where(eq(fechamentos.espacoId, casa.id));
  });
}

/** Cadastra as contas fixas da Casa como elas aparecem nas planilhas, de fevereiro em diante. */
async function cadastrarFixas(db: DB) {
  const fixas: Record<string, number> = {};
  for (const c of CONTAS_CASA) {
    // IRPF começou em junho (parcela 1/8); o resto já estava em fevereiro.
    const inicio = c.chave === "irpf" ? "2026-06" : PRIMEIRO_MES;
    const f = await criarContaFixa(db, {
      espaco: "casa",
      nome: c.nome,
      dia: c.dia,
      valor: c.valor,
      tipo: c.tipo ?? "normal",
      parcelaAtual: c.parcelaNov ? c.parcelaNov - monthDiff(inicio, "2026-11") : null,
      parcelasTotal: c.total ?? null,
      inicioMes: inicio,
    });
    fixas[c.chave] = f.id;
  }
  const fim = addMonths(MES_DA_SEPARACAO, -1);
  fixas.mei = (await criarContaFixa(db, { espaco: "casa", nome: CONTA_MEI.nome, dia: CONTA_MEI.dia, valor: CONTA_MEI.valor, forma: "Boleto", inicioMes: PRIMEIRO_MES, fimMes: fim })).id;
  fixas.unimed = (await criarContaFixa(db, { espaco: "casa", nome: "Unimed", dia: 10, valor: 613_88, inicioMes: "2026-03", fimMes: "2026-07" })).id;
  fixas.reserva = (await criarContaFixa(db, { espaco: "casa", nome: CONTA_RESERVA.nome, dia: CONTA_RESERVA.dia, valor: CONTA_RESERVA.valor, tipo: "reserva", inicioMes: MES_DA_SEPARACAO })).id;
  return fixas;
}

async function cartaoPj(db: DB, casaId: number) {
  const [existe] = await db.select().from(cartoes).where(and(eq(cartoes.espacoId, casaId), eq(cartoes.nome, CARTAO_PJ_CASA.nome)));
  if (existe) return existe;
  const [c] = await db.insert(cartoes).values({ ...CARTAO_PJ_CASA, espacoId: casaId, ordem: 8, ativo: false }).returning();
  return c;
}

export interface RelatorioMes {
  mes: MonthKey;
  planilha: number;
  esperado: number;
  app: number;
  pendentesMarcadas: string[];
  ajustes: string[];
}

/** Importa todos os meses das planilhas para a Casa. Rode `limparCasa` antes se já houver dados. */
export async function importarCasa(db: DB, o: OpcoesImportacao): Promise<RelatorioMes[]> {
  const meses = o.meses ?? MESES_IMPORTADOS;
  const casa0 = await getEspaco(db, "casa");
  await db
    .update(espacos)
    .set({ dataInicio: `${PRIMEIRO_MES}-01`, saldoInicial: o.saldoInicial ?? 0, reservaInicial: o.reservaInicial ?? 0 })
    .where(eq(espacos.id, casa0.id));
  // O espaço fica guardado em memória por banco; atualiza a cópia guardada.
  Object.assign(casa0, { dataInicio: `${PRIMEIRO_MES}-01`, saldoInicial: o.saldoInicial ?? 0, reservaInicial: o.reservaInicial ?? 0 });
  const casa = casa0;

  await cartaoPj(db, casa.id);
  const fixas = await cadastrarFixas(db);
  await gerarMeses(db, casa, meses.map((m) => m.mes));
  const cats = new Map((await db.select().from(categorias).where(eq(categorias.espacoId, casa.id))).map((c) => [c.nome, c.id]));
  const pagas = o.pendentesPassadasComoPagas ?? true;
  const rel: RelatorioMes[] = [];

  for (const m of meses) {
    const separado = m.mes >= MES_DA_SEPARACAO;
    // Esperado = entradas − contas − cartões da própria aba (em abril a aba esqueceu de somar parte das entradas).
    const somaAba = m.entradas.reduce((a, e) => a + e[1], 0) - m.contas.reduce((a, c) => a + c[3], 0) - Object.values(m.cartoes).reduce((a, c) => a + c.total, 0);
    const r: RelatorioMes = { mes: m.mes, planilha: m.resultado, esperado: somaAba, app: 0, pendentesMarcadas: [], ajustes: [] };

    // Entradas: no dia 5. Depois da separação o salário vem pela retirada da Clados.
    for (const [desc, valor] of m.entradas) {
      if (separado && semAcento(desc) === "MATHEUS") {
        r.esperado -= valor;
        continue;
      }
      await lancarEntrada(db, { valor, data: dateInMonth(m.mes, 5), descricao: nomeDaEntrada(desc) });
    }

    // Contas: as fixas usam a conta gerada do mês; as outras viram contas avulsas.
    const usadas = new Set<number>();
    for (const [nome, dia, status, valor] of m.contas) {
      const chave = chaveDaConta(nome);
      if (chave === "mei" && separado) {
        r.esperado += valor;
        continue;
      }
      if (valor === 0) continue;
      let conta: typeof contasMes.$inferSelect | undefined;
      if (chave && fixas[chave]) {
        [conta] = await db.select().from(contasMes).where(and(eq(contasMes.contaFixaId, fixas[chave]), eq(contasMes.mes, m.mes)));
        if (conta && usadas.has(conta.id)) conta = undefined; // a Unimed aparece duas vezes em março
      }
      if (!conta) {
        const nomeAvulsa = chave === "unimed" ? "Unimed (extra)" : chave === "reserva" ? "Provisão" : nome.trim();
        conta = await criarContaAvulsa(db, { espaco: "casa", nome: nomeAvulsa, valor, vencimento: dateInMonth(m.mes, dia ?? 5) });
      }
      usadas.add(conta.id);
      const venceu = conta.vencimento < o.hoje;
      const pagar = status === "PAGO" || status === "AGENDADO" || (pagas && venceu);
      if (status === "PENDENTE" && pagar) r.pendentesMarcadas.push(nome.trim());
      if (pagar) await pagarConta(db, conta.id, { valor, data: conta.vencimento });
      else await db.update(contasMes).set({ valor }).where(eq(contasMes.id, conta.id));
    }
    // Contas fixas geradas que a planilha não tinha neste mês (não deveria acontecer, mas não deixa sobrar).
    const geradas = await db.select().from(contasMes).where(and(eq(contasMes.espacoId, casa.id), eq(contasMes.mes, m.mes)));
    for (const g of geradas) if (!usadas.has(g.id)) r.ajustes.push(`conta ${g.nome} gerada sem linha na planilha`);

    // Cartões: itens espalhados pela janela da fatura (a planilha não tem datas), nunca depois de hoje.
    for (const [aba, c] of Object.entries(m.cartoes)) {
      if (aba === "PJ MATHEUS" && separado) {
        r.esperado += c.total;
        continue;
      }
      if (c.total === 0 && !c.itens.length) continue;
      const nome = CARTAO_DA_ABA[aba];
      const [cartao] = await db.select().from(cartoes).where(and(eq(cartoes.espacoId, casa.id), eq(cartoes.nome, nome)));
      if (!cartao) throw new Error(`Cartão ${nome} não existe na Casa`);
      const itens = c.itens.map(([d, cat, v]) => ({ descricao: nomeDoItem(d, cat), categoria: categoriaDoItem(d, cat), valor: v }));
      const soma = itens.reduce((a, i) => a + i.valor, 0);
      if (soma !== c.total) {
        itens.push({ descricao: itens.length ? "Diferença para o total da planilha" : "Compras do mês", categoria: null, valor: c.total - soma });
        if (c.itens.length) r.ajustes.push(`${nome}: diferença de ${c.total - soma} centavos lançada`);
      }
      const { de, ate } = janelaDaFatura(m.mes, cartao.diaFecha, cartao.diaVence);
      const limite = o.hoje < ate ? o.hoje : ate;
      const span = Math.max(0, Math.round((Date.parse(limite) - Date.parse(de)) / 86_400_000));
      for (const [k, it] of itens.entries()) {
        const data = addDays(de, itens.length > 1 ? Math.round((span * k) / (itens.length - 1)) : span);
        const categoriaId = it.categoria ? (cats.get(it.categoria) ?? null) : null;
        if (it.valor > 0) {
          await lancarCompra(db, { espaco: "casa", valor: it.valor, data, descricao: it.descricao, cartaoId: cartao.id, categoriaId, origem: "arquivo", mesFatura: m.mes });
        } else if (it.valor < 0) {
          // Estornos e pagamentos antecipados abatem a fatura.
          await db.insert(lancamentos).values({ espacoId: casa.id, tipo: "compra", valor: it.valor, data, descricao: it.descricao, categoriaId, cartaoId: cartao.id, mesFatura: m.mes, origem: "arquivo" });
        }
      }
      const f = await faturaDoMes(db, cartao, m.mes);
      if (f.total > 0 && f.vencimento < o.hoje) await pagarFatura(db, { cartaoId: cartao.id, mes: m.mes, data: f.vencimento });
    }

    const mc = await mesCasa(db, m.mes, o.hoje);
    r.app = mc.resultadoDoMes;
    // Dízimo ainda não pago: o app calcula 10% da retirada do mês, em vez do valor fixo da planilha.
    const dizimo = m.contas.find((c) => chaveDaConta(c[0]) === "dizimo");
    if (dizimo && !mc.resumo.dizimoPago && mc.resumo.dizimo !== dizimo[3]) {
      r.esperado += dizimo[3] - mc.resumo.dizimo;
      r.ajustes.push(`dízimo previsto pelo app: ${mc.resumo.dizimo} (planilha ${dizimo[3]})`);
    }
    rel.push(r);
  }

  // Meses que já terminaram ficam fechados, sem levar sobra ou falta: a planilha já acertava isso
  // nas entradas do mês seguinte ("Sobra do mês anterior", "Tirado da reserva", "Ajuste").
  const atual = o.hoje.slice(0, 7);
  for (const r of rel) {
    if (r.mes >= atual) continue;
    await db.insert(fechamentos).values({ espacoId: casa.id, mes: r.mes, resultado: r.app, decisao: r.app >= 0 ? "conta" : "proximo", carrega: 0, fechadoPor: null });
  }
  return rel;
}
