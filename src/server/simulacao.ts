// Reproduz os meses da planilha dentro do app, usando as mesmas ações que as telas usam.
// Serve para os testes e para montar os dados de demonstração.
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { contasMes } from "@/db/schema";
import { CONTA_MEI, CONTA_RESERVA, CONTAS_CASA, type MesPlanilha } from "@/db/planilha";
import { fechamentoDaFatura } from "@/domain/cartao";
import { addDays, addMonths, monthDiff, type ISODate, type MonthKey } from "@/lib/dates";
import { ajustarConta, criarContaFixa, lancarCompra, lancarEntrada, pagarConta, pagarFatura, registrarRetirada } from "./acoes";
import { getEspaco, type TipoEspaco } from "./base";
import { faturaDoMes } from "./casa";
import { gerarMes } from "./gerar";
import { cartaoPorNome, categoriaPorNome } from "./setup";

export type MapaContas = Record<string, { fixaId: number; espaco: TipoEspaco }>;

/**
 * Cadastra as contas fixas da planilha a partir de `inicio`.
 * `meiNa` diz onde fica o DAS: na Casa (como na planilha) ou na Clados (como vai ser no app).
 */
export async function cadastrarContasDaPlanilha(db: DB, inicio: MonthKey, opts: { meiNa: TipoEspaco; reservaDesde?: MonthKey }): Promise<MapaContas> {
  const mapa: MapaContas = {};
  const recuo = monthDiff(inicio, "2026-11");
  for (const c of CONTAS_CASA) {
    const f = await criarContaFixa(db, {
      espaco: "casa",
      nome: c.nome,
      dia: c.dia,
      valor: c.valor,
      tipo: c.tipo ?? "normal",
      parcelaAtual: c.parcelaNov ? c.parcelaNov - recuo : null,
      parcelasTotal: c.total ?? null,
      inicioMes: inicio,
    });
    mapa[c.chave] = { fixaId: f.id, espaco: "casa" };
  }
  const mei = await criarContaFixa(db, {
    espaco: opts.meiNa,
    nome: opts.meiNa === "clados" ? "DAS do MEI" : CONTA_MEI.nome,
    dia: CONTA_MEI.dia,
    valor: CONTA_MEI.valor,
    forma: "Boleto",
    inicioMes: inicio,
  });
  mapa.mei = { fixaId: mei.id, espaco: opts.meiNa };
  const reservaDesde = opts.reservaDesde ?? "2026-11";
  const res = await criarContaFixa(db, { espaco: "casa", nome: CONTA_RESERVA.nome, dia: CONTA_RESERVA.dia, valor: CONTA_RESERVA.valor, tipo: "reserva", inicioMes: reservaDesde });
  mapa.reserva = { fixaId: res.id, espaco: "casa" };
  return mapa;
}

/** Datas possíveis de compra para cair na fatura que vence em `mes`. */
export function janelaDaFatura(mes: MonthKey, diaFecha: number, diaVence: number): { de: ISODate; ate: ISODate } {
  return { de: fechamentoDaFatura(addMonths(mes, -1), diaFecha, diaVence), ate: addDays(fechamentoDaFatura(mes, diaFecha, diaVence), -1) };
}

export interface OpcoesMes {
  /** Cartões que ficam na Clados (pagos pela conta da Clados). */
  cartaoPara?: (nome: string) => string;
  /** Só faz o que aconteceu até essa data (para a demonstração parar em "hoje"). */
  ate?: ISODate;
  /** Lança as compras e não paga as faturas nem as contas. */
  soCompras?: boolean;
}

/** Lança as compras de cada cartão para caírem na fatura do mês. */
export async function lancarComprasDoMes(db: DB, mp: MesPlanilha, opts: OpcoesMes = {}) {
  for (const grupo of mp.cartoes) {
    const cartao = await cartaoPorNome(db, opts.cartaoPara ? opts.cartaoPara(grupo.cartao) : grupo.cartao);
    const espaco = (await getEspaco(db, "casa")).id === cartao.espacoId ? "casa" : "clados";
    const esp = await getEspaco(db, espaco);
    const { de, ate } = janelaDaFatura(mp.mes, cartao.diaFecha, cartao.diaVence);
    const limite = opts.ate && opts.ate < ate ? opts.ate : ate;
    for (const [k, compra] of grupo.compras.entries()) {
      // Espalha as compras pela janela da fatura, sem passar de `limite`.
      const span = Math.max(0, Math.round((Date.parse(limite) - Date.parse(de)) / 86_400_000));
      const data = addDays(de, grupo.compras.length > 1 ? Math.round((span * k) / (grupo.compras.length - 1)) : span);
      const cat = compra.categoria ? await categoriaPorNome(db, esp.id, compra.categoria) : null;
      await lancarCompra(db, { espaco, valor: compra.valor, data, descricao: compra.descricao, cartaoId: cartao.id, categoriaId: cat?.id ?? null, origem: "sistema", mesFatura: mp.mes });
    }
  }
}

/** Faz o mês inteiro da planilha: entradas, contas pagas com o valor real e faturas pagas no vencimento. */
export async function executarMes(db: DB, mp: MesPlanilha, mapa: MapaContas, opts: OpcoesMes = {}) {
  const ok = (d: ISODate) => !opts.ate || d <= opts.ate;
  const casa = await getEspaco(db, "casa");
  const clados = await getEspaco(db, "clados");
  await gerarMes(db, casa, mp.mes);
  await gerarMes(db, clados, mp.mes);

  for (const e of mp.entradas) {
    const data = `${mp.mes}-05`;
    if (!ok(data)) continue;
    if (e.retirada) await registrarRetirada(db, { valor: e.valor, data });
    else await lancarEntrada(db, { valor: e.valor, data, descricao: e.descricao });
  }

  await lancarComprasDoMes(db, mp, opts);
  if (opts.soCompras) return;

  for (const c of mp.contas) {
    const m = mapa[c.chave];
    if (!m) throw new Error(`Conta ${c.chave} não cadastrada`);
    const [cm] = await db.select().from(contasMes).where(and(eq(contasMes.contaFixaId, m.fixaId), eq(contasMes.mes, mp.mes)));
    if (!cm) throw new Error(`Conta ${c.chave} não gerada em ${mp.mes}`);
    if (!ok(cm.vencimento)) {
      // Ainda não venceu: fica prevista com o valor que a planilha mostra.
      if (cm.tipo !== "dizimo") await ajustarConta(db, cm.id, c.valor);
      continue;
    }
    await pagarConta(db, cm.id, { valor: c.valor, data: cm.vencimento });
  }

  for (const grupo of mp.cartoes) {
    const cartao = await cartaoPorNome(db, opts.cartaoPara ? opts.cartaoPara(grupo.cartao) : grupo.cartao);
    const f = await faturaDoMes(db, cartao, mp.mes);
    if (f.total > 0 && ok(f.vencimento)) await pagarFatura(db, { cartaoId: cartao.id, mes: mp.mes, data: f.vencimento });
  }
}
