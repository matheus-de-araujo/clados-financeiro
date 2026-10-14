// Três meses seguidos com os dados reais das planilhas (setembro, outubro e novembro de 2026).
import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryDb, type DB } from "@/db";
import { MESES_PLANILHA, NOVEMBRO, OUTUBRO, SETEMBRO } from "@/db/planilha";
import { fecharMes, lancarEntrada, movimentarReserva, registrarRecebimento, reabrirMes } from "@/server/acoes";
import { getEspaco, saldoConta, saldoReserva } from "@/server/base";
import { mesCasa } from "@/server/casa";
import { mesClados } from "@/server/clados";
import { cadastrarContasDaPlanilha, executarMes, type MapaContas } from "@/server/simulacao";
import { criarEspacos } from "@/server/setup";
import { lastDay } from "@/lib/dates";
import { sum } from "@/lib/money";

const RECEBIMENTOS = { "2026-09": 10_000_00, "2026-10": 9_000_00, "2026-11": 9_000_00 } as Record<string, number>;

describe("as somas da planilha batem", () => {
  it.each(MESES_PLANILHA)("$mes: entradas − saídas = resultado da planilha", (mp) => {
    const entradas = sum(mp.entradas.map((e) => e.valor));
    const saidas = sum(mp.contas.map((c) => c.valor)) + sum(mp.cartoes.flatMap((c) => c.compras.map((x) => x.valor)));
    expect(entradas - saidas).toBe(mp.resultado);
  });
});

describe("cenário 1: igual à planilha (cartão PJ e MEI ainda na Casa), falta levada para o mês seguinte", () => {
  let db: DB;
  let mapa: MapaContas;

  beforeAll(async () => {
    db = await createMemoryDb();
    await criarEspacos(db, { cladosInicio: "2026-09-01", cladosSaldo: 6_200_00, reservaMinima: 2_000_00, casaInicio: "2026-09-01", casaSaldo: 0, reservaInicial: 0, pjNaCasa: true });
    mapa = await cadastrarContasDaPlanilha(db, "2026-09", { meiNa: "casa" });
  });

  it("setembro: resultado −R$ 441,14, igual à planilha", async () => {
    await registrarRecebimento(db, { valor: RECEBIMENTOS["2026-09"], data: "2026-09-02", descricao: "Clientes de setembro" });
    await executarMes(db, SETEMBRO, mapa);
    const m = await mesCasa(db, "2026-09");
    expect(m.resultadoDoMes).toBe(-441_14);
    expect(m.resumo.resultado).toBe(-441_14);
    expect(m.resumo.entrou).toBe(16_840_00);
    expect(m.resumo.precisa).toBe(17_281_14);
    expect(m.retiradas).toBe(8_500_00);
    expect(m.resumo.dizimo).toBe(850_00);
    expect(m.resumo.faltaEntrar).toBe(441_14);
    // A conta da Casa termina o mês exatamente no resultado (começou em zero).
    expect(m.saldoConta).toBe(-441_14);
  });

  it("a retirada saiu da Clados e o saldo da Clados passa para outubro", async () => {
    const clados = await getEspaco(db, "clados");
    expect(await saldoConta(db, clados, lastDay("2026-09"))).toBe(6_200_00 + 10_000_00 - 8_500_00);
  });

  it("fechar setembro levando a falta para outubro", async () => {
    await expect(fecharMes(db, "2026-10", "proximo")).rejects.toThrow("Feche o mês anterior primeiro");
    await expect(fecharMes(db, "2026-09", "reserva")).rejects.toThrow();
    const f = await fecharMes(db, "2026-09", "proximo");
    expect(f.carrega).toBe(-441_14);
    await expect(fecharMes(db, "2026-09", "proximo")).rejects.toThrow("já foi fechado");
  });

  it("outubro: resultado do mês −R$ 2.798,37 e, com a falta de setembro, −R$ 3.239,51", async () => {
    await registrarRecebimento(db, { valor: RECEBIMENTOS["2026-10"], data: "2026-10-02", descricao: "Clientes de outubro" });
    await executarMes(db, OUTUBRO, mapa);
    const m = await mesCasa(db, "2026-10");
    expect(m.anterior).toBe(-441_14);
    expect(m.resultadoDoMes).toBe(-2_798_37);
    expect(m.resumo.faltaAnterior).toBe(441_14);
    expect(m.resumo.resultado).toBe(-3_239_51);
    expect(m.saldoConta).toBe(-3_239_51);
    await fecharMes(db, "2026-10", "proximo");
  });

  it("novembro: resultado do mês +R$ 338,85; acumulado −R$ 2.900,66; reserva começa com R$ 708,80", async () => {
    await registrarRecebimento(db, { valor: RECEBIMENTOS["2026-11"], data: "2026-11-02", descricao: "Clientes de novembro" });
    await executarMes(db, NOVEMBRO, mapa);
    const m = await mesCasa(db, "2026-11");
    expect(m.resultadoDoMes).toBe(338_85);
    expect(m.resumo.resultado).toBe(-2_900_66);
    expect(m.saldoConta).toBe(-2_900_66);
    expect(m.reserva).toBe(708_80);
    // Todas as contas de novembro estão pagas.
    expect(m.contas.every((c) => c.pagoEm)).toBe(true);
    expect(m.faturas.find((f) => f.cartao.nome === "Nubank Dayane")?.total).toBe(2_939_11);
  });

  it("Clados acumulou o saldo dos três meses", async () => {
    const clados = await getEspaco(db, "clados");
    expect(await saldoConta(db, clados)).toBe(6_200_00 + 28_000_00 - 3 * 8_500_00);
  });

  it("dezembro começa com a falta acumulada de novembro", async () => {
    await fecharMes(db, "2026-11", "proximo");
    const d = await mesCasa(db, "2026-12");
    expect(d.resumo.faltaAnterior).toBe(2_900_66);
  });

  it("reabrir novembro desfaz o fechamento", async () => {
    await expect(reabrirMes(db, "2026-10")).rejects.toThrow("Reabra primeiro o mês seguinte");
    await reabrirMes(db, "2026-11");
    const d = await mesCasa(db, "2026-12");
    expect(d.resumo.faltaAnterior).toBe(0);
  });
});

describe("cenário 2: separado como no app (cartão PJ e DAS na Clados), sobra para a reserva e falta coberta pela reserva", () => {
  let db: DB;
  let mapa: MapaContas;
  const pjNaClados = (nome: string) => (nome === "Cartão PJ" ? "Cartão Clados" : nome);
  const RECEB2 = { "2026-09": 12_000_00, "2026-10": 10_000_00, "2026-11": 10_000_00 } as Record<string, number>;
  const pj = (mes: string) => sum(MESES_PLANILHA.find((m) => m.mes === mes)!.cartoes.find((c) => c.cartao === "Cartão PJ")!.compras.map((c) => c.valor));
  const DAS = 86_05;

  beforeAll(async () => {
    db = await createMemoryDb();
    await criarEspacos(db, { cladosInicio: "2026-09-01", cladosSaldo: 6_200_00, reservaMinima: 2_000_00, casaInicio: "2026-09-01", casaSaldo: 0, reservaInicial: 0 });
    mapa = await cadastrarContasDaPlanilha(db, "2026-09", { meiNa: "clados" });
  });

  it("setembro: sem o cartão PJ e o DAS, a Casa sobra R$ 7.989,41 e vai para a reserva", async () => {
    await registrarRecebimento(db, { valor: RECEB2["2026-09"], data: "2026-09-01", descricao: "Clientes" });
    await executarMes(db, SETEMBRO, mapa, { cartaoPara: pjNaClados });
    const m = await mesCasa(db, "2026-09");
    expect(m.resultadoDoMes).toBe(-441_14 + pj("2026-09") + DAS);
    expect(m.resultadoDoMes).toBe(7_989_41);
    await fecharMes(db, "2026-09", "reserva");
    const casa = await getEspaco(db, "casa");
    expect(await saldoReserva(db, casa)).toBe(7_989_41);
    expect(await saldoConta(db, casa)).toBe(0);
  });

  it("outubro: falta R$ 1.771,73 e sai da reserva", async () => {
    await registrarRecebimento(db, { valor: RECEB2["2026-10"], data: "2026-10-01", descricao: "Clientes" });
    await executarMes(db, OUTUBRO, mapa, { cartaoPara: pjNaClados });
    const m = await mesCasa(db, "2026-10");
    expect(m.anterior).toBe(0);
    expect(m.resultadoDoMes).toBe(-2_798_37 + pj("2026-10") + DAS);
    expect(m.resultadoDoMes).toBe(-1_771_73);
    await fecharMes(db, "2026-10", "resgatar");
    const casa = await getEspaco(db, "casa");
    expect(await saldoReserva(db, casa)).toBe(7_989_41 - 1_771_73);
    expect(await saldoConta(db, casa)).toBe(0);
  });

  it("novembro: sobra R$ 1.177,57, fica na conta e entra em dezembro", async () => {
    await registrarRecebimento(db, { valor: RECEB2["2026-11"], data: "2026-11-01", descricao: "Clientes" });
    await executarMes(db, NOVEMBRO, mapa, { cartaoPara: pjNaClados });
    const m = await mesCasa(db, "2026-11");
    expect(m.resultadoDoMes).toBe(338_85 + pj("2026-11") + DAS);
    expect(m.resultadoDoMes).toBe(1_177_57);
    await fecharMes(db, "2026-11", "conta");
    const casa = await getEspaco(db, "casa");
    expect(await saldoReserva(db, casa)).toBe(7_989_41 - 1_771_73 + 708_80);
    const d = await mesCasa(db, "2026-12");
    expect(d.resumo.sobraAnterior).toBe(1_177_57);
    expect(d.resumo.entrou).toBe(1_177_57);
  });

  it("Clados: saldo passa de mês para mês com recebimentos, fatura PJ, DAS e retiradas", async () => {
    const clados = await getEspaco(db, "clados");
    const esperado = (ate: string) => {
      const meses = ["2026-09", "2026-10", "2026-11"].filter((m) => m <= ate);
      return 6_200_00 + sum(meses.map((m) => RECEB2[m] - pj(m) - DAS - 8_500_00));
    };
    expect(await saldoConta(db, clados, lastDay("2026-09"))).toBe(esperado("2026-09"));
    expect(await saldoConta(db, clados, lastDay("2026-10"))).toBe(esperado("2026-10"));
    expect(await saldoConta(db, clados, lastDay("2026-11"))).toBe(esperado("2026-11"));
    expect(esperado("2026-09")).toBe(1_269_45);
    expect(esperado("2026-11")).toBe(2_404_09);
  });

  it("Clados: pode retirar desconta o que vence em 30 dias e a reserva mínima", async () => {
    // Em 01/12, depois de receber R$ 10.000: o DAS de dezembro vence em 20/12.
    await registrarRecebimento(db, { valor: 10_000_00, data: "2026-12-01", descricao: "Clientes" });
    const c = await mesClados(db, "2026-12", "2026-12-01");
    expect(c.saldo).toBe(2_404_09 + 10_000_00);
    expect(c.comprometido.contas).toBe(DAS);
    expect(c.podeRetirar).toBe(c.saldo - c.comprometido.total - 2_000_00);
    expect(c.mei.faturado).toBe(12_000_00 + 10_000_00 + 10_000_00 + 10_000_00);
  });

  it("Entrou da Dayane conta como outra entrada e reduz a meta de retirada", async () => {
    const antes = await mesCasa(db, "2026-12");
    await lancarEntrada(db, { valor: 2_000_00, data: "2026-12-12", descricao: "Serviço de design" });
    const depois = await mesCasa(db, "2026-12");
    expect(depois.outrasEntradas).toBe(2_000_00);
    expect(antes.resumo.metaRetirada - depois.resumo.metaRetirada).toBeGreaterThanOrEqual(2_000_00);
  });

  it("guardar e usar a reserva manualmente", async () => {
    const casa = await getEspaco(db, "casa");
    const r0 = await saldoReserva(db, casa);
    await movimentarReserva(db, { acao: "guardar", valor: 100_00, data: "2026-12-13" });
    expect(await saldoReserva(db, casa)).toBe(r0 + 100_00);
    await expect(movimentarReserva(db, { acao: "resgatar", valor: r0 + 1_000_00, data: "2026-12-13" })).rejects.toThrow("não tem esse valor");
  });
});
