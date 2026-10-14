// Fluxo do dia a dia, do jeito que as telas usam.
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createMemoryDb, type DB } from "@/db";
import { contasMes, lancamentos } from "@/db/schema";
import {
  conferirFatura,
  criarCliente,
  criarContaFixa,
  criarContrato,
  desmarcarConta,
  excluirLancamento,
  gerarCobrancaHoras,
  lancarCompra,
  pagarConta,
  pagarFatura,
  registrarHoras,
  registrarRecebimento,
  registrarRetirada,
  valorSugeridoConta,
} from "@/server/acoes";
import { getEspaco, saldoConta } from "@/server/base";
import { faturaDoMes, mesCasa } from "@/server/casa";
import { listaClientes, mesClados, recebiveisAbertos } from "@/server/clados";
import { cartaoPorNome } from "@/server/setup";
import { criarEspacos } from "@/server/setup";

let db: DB;
const HOJE = "2026-10-14";

beforeAll(async () => {
  db = await createMemoryDb();
  await criarEspacos(db, { cladosInicio: "2026-10-01", cladosSaldo: 6_200_00, reservaMinima: 2_000_00, casaInicio: "2026-10-01", casaSaldo: 0, reservaInicial: 3_200_00 });
});

describe("Clados: clientes, horas e recebimentos", () => {
  let delta: number;
  let alfa: number;
  let beta: number;

  it("cadastra clientes com os três tipos de contrato", async () => {
    alfa = (await criarCliente(db, { nome: "Alfa Ltda", telefone: "5511999990000", desde: "2026-10-01" })).id;
    beta = (await criarCliente(db, { nome: "Beta Comércio", desde: "2026-10-01" })).id;
    delta = (await criarCliente(db, { nome: "Delta Engenharia", desde: "2026-10-01" })).id;
    await criarContrato(db, { clienteId: alfa, tipo: "suporte", descricao: "Suporte", mensalidade: 2_000_00, dia: 10, inicioMes: "2026-10" });
    await criarContrato(db, {
      clienteId: beta,
      tipo: "projeto",
      descricao: "Site institucional",
      valorTotal: 3_000_00,
      parcelas: [
        { valor: 1_500_00, vencimento: "2026-10-14" },
        { valor: 1_500_00, vencimento: "2026-11-15" },
      ],
    });
    await expect(
      criarContrato(db, { clienteId: beta, tipo: "projeto", descricao: "Errado", valorTotal: 3_000_00, parcelas: [{ valor: 1_000_00, vencimento: "2026-10-14" }] }),
    ).rejects.toThrow("somar");
    await criarContrato(db, { clienteId: delta, tipo: "hora", descricao: "Manutenção", valorHora: 150_00 });
  });

  it("suporte gera a mensalidade do mês e aparece atrasado depois do dia", async () => {
    const c = await mesClados(db, "2026-10", HOJE);
    const atrasados = c.atrasados.map((a) => a.cliente.nome);
    expect(atrasados).toContain("Alfa Ltda");
    expect(c.proximos.map((p) => p.contratado)).toEqual([2_000_00 + 1_500_00, 2_000_00, 2_000_00]);
  });

  it("horas viram cobrança", async () => {
    const [ct] = (await listaClientes(db, HOJE)).find((x) => x.cliente.id === delta)!.contratos;
    await registrarHoras(db, { contratoId: ct.id, minutos: 150, descricao: "Ajuste no formulário", data: HOJE }, HOJE);
    await registrarHoras(db, { contratoId: ct.id, minutos: 480, descricao: "Nova página", data: HOJE }, HOJE);
    let c = await mesClados(db, "2026-10", HOJE);
    expect(c.horasAbertas[0].minutos).toBe(630);
    expect(c.horasAbertas[0].valor).toBe(1_575_00);
    const r = await gerarCobrancaHoras(db, ct.id, HOJE);
    expect(r.valor).toBe(1_575_00);
    c = await mesClados(db, "2026-10", HOJE);
    expect(c.horasAbertas).toHaveLength(0);
    await expect(gerarCobrancaHoras(db, ct.id, HOJE)).rejects.toThrow("Não há horas");
  });

  it("recebi: baixa a cobrança, entra no saldo e no faturamento do MEI", async () => {
    const abertos = await recebiveisAbertos(db);
    const parcela = abertos.find((a) => a.cliente.nome === "Beta Comércio" && a.r.parcela === 1)!;
    await registrarRecebimento(db, { recebivelId: parcela.r.id, valor: parcela.r.valor, data: HOJE, nf: true });
    await expect(registrarRecebimento(db, { recebivelId: parcela.r.id, valor: 1, data: HOJE })).rejects.toThrow("já foi recebida");
    const c = await mesClados(db, "2026-10", HOJE);
    expect(c.saldo).toBe(6_200_00 + 1_500_00);
    expect(c.mei.faturado).toBe(1_500_00);
    const lista = await listaClientes(db, HOJE);
    const b = lista.find((x) => x.cliente.nome === "Beta Comércio")!;
    expect(b.recebidoAno).toBe(1_500_00);
    expect(b.emAberto).toBe(1_500_00);
  });
});

describe("Clados: contas fixas no cartão, pode retirar e retirada", () => {
  it("Claude Max no cartão Clados cai na fatura de novembro e entra no comprometido", async () => {
    const cartao = await cartaoPorNome(db, "Cartão Clados");
    await criarContaFixa(db, { espaco: "clados", nome: "Claude Max", dia: 5, valor: 550_00, cartaoId: cartao.id, inicioMes: "2026-10" });
    await criarContaFixa(db, { espaco: "clados", nome: "DAS do MEI", dia: 20, valor: 86_05, forma: "Boleto", inicioMes: "2026-10" });
    const c = await mesClados(db, "2026-10", HOJE);
    const fat = await faturaDoMes(db, cartao, "2026-11");
    expect(fat.total).toBe(550_00);
    expect(c.comprometido.faturas).toBe(550_00);
    expect(c.comprometido.contas).toBe(86_05);
    expect(c.podeRetirar).toBe(7_700_00 - 636_05 - 2_000_00);
    expect(c.fixasMes).toBe(636_05);
  });

  it("retirada sai da Clados e entra na Casa como retirada", async () => {
    await registrarRetirada(db, { valor: 1_000_00, data: HOJE });
    const c = await mesClados(db, "2026-10", HOJE);
    expect(c.retirado).toBe(1_000_00);
    expect(c.saldo).toBe(6_700_00);
    const casa = await mesCasa(db, "2026-10", HOJE);
    expect(casa.retiradas).toBe(1_000_00);
    expect(casa.saldoConta).toBe(1_000_00);
  });

  it("excluir a retirada do lado da Casa também tira da Clados", async () => {
    const casa = await getEspaco(db, "casa");
    const [e] = await db.select().from(lancamentos).where(and(eq(lancamentos.espacoId, casa.id), eq(lancamentos.tipo, "entrada")));
    await excluirLancamento(db, e.id);
    const clados = await getEspaco(db, "clados");
    expect(await saldoConta(db, clados)).toBe(7_700_00);
    expect(await saldoConta(db, casa)).toBe(0);
    await registrarRetirada(db, { valor: 1_000_00, data: HOJE });
  });
});

describe("Casa: gastos, parcelas, conferência, fatura e contas", () => {
  it("compra parcelada em 3x cai em três faturas seguidas", async () => {
    const cartao = await cartaoPorNome(db, "Nubank Matheus");
    const ls = await lancarCompra(db, { espaco: "casa", valor: 300_01, data: HOJE, descricao: "Tênis", cartaoId: cartao.id, parcelas: 3 });
    expect(ls.map((l) => [l.mesFatura, l.valor])).toEqual([
      ["2026-11", 100_01],
      ["2026-12", 100_00],
      ["2027-01", 100_00],
    ]);
    await excluirLancamento(db, ls[1].id);
    expect((await faturaDoMes(db, cartao, "2026-11")).total).toBe(0);
  });

  it("gasto no débito sai da conta e entra no precisa do mês", async () => {
    const antes = await mesCasa(db, "2026-10", HOJE);
    await lancarCompra(db, { espaco: "casa", valor: 89_90, data: HOJE, descricao: "Atacadão", cartaoId: null });
    const depois = await mesCasa(db, "2026-10", HOJE);
    expect(depois.resumo.precisa - antes.resumo.precisa).toBe(89_90);
    expect(depois.saldoConta - antes.saldoConta).toBe(-89_90);
  });

  it("conferência acha a diferença e lança como sem categoria", async () => {
    const cartao = await cartaoPorNome(db, "Nubank Dayane");
    await lancarCompra(db, { espaco: "casa", valor: 2_500_00, data: "2026-10-05", descricao: "Compras", cartaoId: cartao.id });
    const r = await conferirFatura(db, { cartaoId: cartao.id, mes: "2026-11", totalNoBanco: 3_000_00, data: HOJE });
    expect(r.diferenca).toBe(500_00);
    await conferirFatura(db, { cartaoId: cartao.id, mes: "2026-11", totalNoBanco: 3_000_00, data: HOJE, lancarDiferenca: true });
    const f = await faturaDoMes(db, cartao, "2026-11");
    expect(f.total).toBe(3_000_00);
    expect(f.conferidoValor).toBe(3_000_00);
  });

  it("pagar a fatura tira da conta o total; não paga duas vezes", async () => {
    const cartao = await cartaoPorNome(db, "Nubank Dayane");
    const casa = await getEspaco(db, "casa");
    const antes = await saldoConta(db, casa);
    await pagarFatura(db, { cartaoId: cartao.id, mes: "2026-11", data: "2026-11-10" });
    expect(await saldoConta(db, casa)).toBe(antes - 3_000_00);
    await expect(pagarFatura(db, { cartaoId: cartao.id, mes: "2026-11", data: "2026-11-10" })).rejects.toThrow("já está paga");
  });

  it("dízimo sugere 10% das retiradas do mês; desmarcar devolve o dinheiro", async () => {
    const f = await criarContaFixa(db, { espaco: "casa", nome: "Dízimo", dia: 20, valor: 0, tipo: "dizimo", inicioMes: "2026-10" });
    const [cm] = await db.select().from(contasMes).where(and(eq(contasMes.contaFixaId, f.id), eq(contasMes.mes, "2026-10")));
    expect(await valorSugeridoConta(db, cm.id)).toBe(100_00);
    const casa = await getEspaco(db, "casa");
    const antes = await saldoConta(db, casa);
    await pagarConta(db, cm.id, { data: HOJE });
    expect(await saldoConta(db, casa)).toBe(antes - 100_00);
    await desmarcarConta(db, cm.id);
    expect(await saldoConta(db, casa)).toBe(antes);
  });

  it("conta parcelada termina na última parcela", async () => {
    await criarContaFixa(db, { espaco: "casa", nome: "IRPF", dia: 31, valor: 237_03, parcelaAtual: 7, parcelasTotal: 8, inicioMes: "2026-12" });
    const dez = await mesCasa(db, "2026-12");
    const jan = await mesCasa(db, "2027-01");
    const fev = await mesCasa(db, "2027-02");
    expect(dez.contas.find((c) => c.nome === "IRPF")?.parcela).toBe(7);
    expect(jan.contas.find((c) => c.nome === "IRPF")?.parcela).toBe(8);
    expect(fev.contas.find((c) => c.nome === "IRPF")).toBeUndefined();
    expect(dez.contas.find((c) => c.nome === "IRPF")?.vencimento).toBe("2026-12-31");
  });
});
