// Dados de demonstração: as planilhas de setembro e outubro de 2026 como aconteceram,
// novembro já no modelo novo (cartão e DAS na Clados) e clientes de exemplo.
import { hashPassword } from "better-auth/crypto";
import type { DB } from "@/db";
import { account, espacos, membros, user } from "@/db/schema";
import { CONTA_MEI, CONTA_RESERVA, CONTAS_CASA, NOVEMBRO, OUTUBRO, SETEMBRO, type MesPlanilha } from "@/db/planilha";
import { todayISO, monthDiff } from "@/lib/dates";
import {
  criarCliente,
  criarContaAvulsa,
  criarContaFixa,
  criarContrato,
  fecharMes,
  pagarConta,
  registrarHoras,
  registrarRecebimento,
} from "@/server/acoes";
import { cartaoPorNome } from "@/server/setup";
import { criarEspacos } from "@/server/setup";
import { executarMes, lancarComprasDoMes, type MapaContas } from "@/server/simulacao";
import { recebiveisAbertos } from "@/server/clados";

export const DEMO_USERS = [
  { id: "u-matheus", name: "Matheus", email: "matheus@demo.app", password: "clados2026" },
  { id: "u-dayane", name: "Dayane", email: "dayane@demo.app", password: "clados2026" },
];

/** Na demonstração, "hoje" é a data real, mas nunca antes de 14/10/2026 (quando os dados param). */
export function hojeDemo(): string {
  const h = todayISO();
  return h < "2026-10-14" ? "2026-10-14" : h;
}

export async function criarUsuario(db: DB, u: { id: string; name: string; email: string; password: string }) {
  await db.insert(user).values({ id: u.id, name: u.name, email: u.email, emailVerified: true });
  await db.insert(account).values({ id: `acc-${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password: await hashPassword(u.password) });
}

export async function seedDemo(db: DB) {
  const existe = await db.select().from(espacos).limit(1);
  if (existe.length) return;
  const ate = "2026-10-14";

  const { clados, casa } = await criarEspacos(db, {
    cladosInicio: "2026-10-01",
    cladosSaldo: 6_200_00,
    reservaMinima: 2_000_00,
    casaInicio: "2026-09-01",
    casaSaldo: 0,
    reservaInicial: 0,
  });

  for (const u of DEMO_USERS) await criarUsuario(db, u);
  await db.insert(membros).values([
    { userId: "u-matheus", espacoId: clados.id, papel: "edita", padrao: true },
    { userId: "u-matheus", espacoId: casa.id, papel: "edita", padrao: false },
    { userId: "u-dayane", espacoId: casa.id, papel: "edita", padrao: true },
    { userId: "u-dayane", espacoId: clados.id, papel: "ve", padrao: false },
  ]);

  // ---- Casa: contas fixas da planilha ----
  const mapa: MapaContas = {};
  const recuo = monthDiff("2026-09", "2026-11");
  for (const c of CONTAS_CASA) {
    const f = await criarContaFixa(db, {
      espaco: "casa",
      nome: c.nome,
      dia: c.dia,
      valor: c.valor,
      tipo: c.tipo ?? "normal",
      parcelaAtual: c.parcelaNov ? c.parcelaNov - recuo : null,
      parcelasTotal: c.total ?? null,
      inicioMes: "2026-09",
    });
    mapa[c.chave] = { fixaId: f.id, espaco: "casa" };
  }
  // O MEI ficou na Casa até outubro; a partir de novembro, o DAS é da Clados.
  const mei = await criarContaFixa(db, { espaco: "casa", nome: CONTA_MEI.nome, dia: CONTA_MEI.dia, valor: CONTA_MEI.valor, forma: "Boleto", inicioMes: "2026-09", fimMes: "2026-10" });
  mapa.mei = { fixaId: mei.id, espaco: "casa" };
  const res = await criarContaFixa(db, { espaco: "casa", nome: CONTA_RESERVA.nome, dia: CONTA_RESERVA.dia, valor: CONTA_RESERVA.valor, tipo: "reserva", inicioMes: "2026-11" });
  mapa.reserva = { fixaId: res.id, espaco: "casa" };

  // Setembro e outubro como na planilha: o salário entrou como renda e o cartão PJ era pago pela Casa.
  const comoPlanilha = (mp: MesPlanilha): MesPlanilha => ({
    ...mp,
    entradas: mp.entradas.map((e) => (e.retirada ? { descricao: "Salário Matheus", valor: e.valor } : e)),
    cartoes: mp.cartoes.filter((c) => c.cartao !== "Cartão PJ"),
  });
  for (const mp of [SETEMBRO, OUTUBRO]) {
    const pj = mp.cartoes.find((c) => c.cartao === "Cartão PJ")!.compras.reduce((a, c) => a + c.valor, 0);
    const venc = `${mp.mes}-06`;
    const conta = await criarContaAvulsa(db, { espaco: "casa", nome: "Cartão PJ (antes da Clados)", valor: pj, vencimento: venc });
    if (venc <= ate) await pagarConta(db, conta.id, { valor: pj, data: venc });
    await executarMes(db, comoPlanilha(mp), mapa, { ate });
    if (mp.mes === "2026-09") await fecharMes(db, "2026-09", "proximo", "u-matheus");
  }

  // Novembro: compras da Dayane até hoje caem na fatura de novembro.
  await lancarComprasDoMes(db, { ...NOVEMBRO, cartoes: NOVEMBRO.cartoes.filter((c) => c.cartao === "Nubank Dayane") }, { ate });

  // ---- Clados ----
  const cc = await cartaoPorNome(db, "Cartão Clados");
  await criarContaFixa(db, { espaco: "clados", nome: "Canva", dia: 5, valor: 24_16, cartaoId: cc.id, parcelaAtual: 2, parcelasTotal: 12, inicioMes: "2026-10" });
  await criarContaFixa(db, { espaco: "clados", nome: "edz Coo", dia: 5, valor: 258_56, cartaoId: cc.id, parcelaAtual: 9, parcelasTotal: 12, inicioMes: "2026-10" });
  await criarContaFixa(db, { espaco: "clados", nome: "Óculos", dia: 5, valor: 117_00, cartaoId: cc.id, parcelaAtual: 10, parcelasTotal: 10, inicioMes: "2026-10" });
  await criarContaFixa(db, { espaco: "clados", nome: "Celular", dia: 5, valor: 352_95, cartaoId: cc.id, parcelaAtual: 5, parcelasTotal: 8, inicioMes: "2026-10" });
  await criarContaFixa(db, { espaco: "clados", nome: "Claude Max", dia: 5, valor: 550_00, cartaoId: cc.id, inicioMes: "2026-11" });
  await criarContaFixa(db, { espaco: "clados", nome: "DAS do MEI", dia: 20, valor: 86_05, forma: "Boleto", inicioMes: "2026-11" });

  const alfa = await criarCliente(db, { nome: "Alfa Ltda", telefone: "5511999990000", desde: "2026-10-01" });
  const beta = await criarCliente(db, { nome: "Beta Comércio", telefone: "5511988880000", desde: "2026-10-01" });
  const delta = await criarCliente(db, { nome: "Delta Engenharia", telefone: "5511977770000", desde: "2026-10-01" });
  await criarContrato(db, { clienteId: alfa.id, tipo: "suporte", descricao: "Suporte", mensalidade: 2_000_00, dia: 10, inicioMes: "2026-10" });
  await criarContrato(db, {
    clienteId: beta.id,
    tipo: "projeto",
    descricao: "Site institucional",
    valorTotal: 3_000_00,
    parcelas: [
      { valor: 1_500_00, vencimento: "2026-10-14", descricao: "Entrada 50%" },
      { valor: 1_500_00, vencimento: "2026-11-15", descricao: "Na entrega" },
    ],
  });
  const betaHora = await criarContrato(db, { clienteId: beta.id, tipo: "hora", descricao: "Manutenção do site", valorHora: 150_00 });
  const deltaHora = await criarContrato(db, { clienteId: delta.id, tipo: "hora", descricao: "Manutenção", valorHora: 150_00 });
  await registrarHoras(db, { contratoId: betaHora.id, minutos: 180, descricao: "Ajuste no menu", data: "2026-10-09" }, ate);
  await registrarHoras(db, { contratoId: deltaHora.id, minutos: 480, descricao: "Nova área de projetos", data: "2026-10-08" }, ate);

  const abertos = await recebiveisAbertos(db);
  const entrada = abertos.find((a) => a.cliente.id === beta.id && a.r.descricao === "Entrada 50%")!;
  await registrarRecebimento(db, { recebivelId: entrada.r.id, valor: entrada.r.valor, data: "2026-10-14", nf: true }, "u-matheus");

}
