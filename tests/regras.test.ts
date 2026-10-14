import { describe, expect, it } from "vitest";
import { dividirParcelas, fechamentoDaFatura, mesDaFatura, planejarCompra, vencimentoDaFatura, diferencaConferencia } from "@/domain/cartao";
import { carregaParaProximo, dizimoSugerido, opcoesFechamento, resumoCasa } from "@/domain/casa";
import { excessoRetirada, faturamentoNecessario, podeRetirar, situacaoMei, valorHoras, formatHoras } from "@/domain/clados";
import { addMonths, dateInMonth } from "@/lib/dates";
import { brl, brlShort, parseBRL, signed } from "@/lib/money";

describe("cartão: em qual fatura cai a compra", () => {
  it("fecha 30 e vence 6: até 29/10 vence em novembro, de 30/10 em diante em dezembro", () => {
    expect(mesDaFatura("2026-10-29", 30, 6)).toBe("2026-11");
    expect(mesDaFatura("2026-10-30", 30, 6)).toBe("2026-12");
    expect(mesDaFatura("2026-10-31", 30, 6)).toBe("2026-12");
    expect(mesDaFatura("2026-10-01", 30, 6)).toBe("2026-11");
  });

  it("fecha 3 e vence 10 (vencimento depois do fechamento)", () => {
    expect(mesDaFatura("2026-10-02", 3, 10)).toBe("2026-10");
    expect(mesDaFatura("2026-10-03", 3, 10)).toBe("2026-11");
    expect(mesDaFatura("2026-12-15", 3, 10)).toBe("2027-01");
  });

  it("fevereiro: vencimento 30 fica no último dia do mês", () => {
    expect(vencimentoDaFatura("2027-02", 30)).toBe("2027-02-28");
    expect(vencimentoDaFatura("2028-02", 30)).toBe("2028-02-29");
    expect(dateInMonth("2026-04", 31)).toBe("2026-04-30");
  });

  it("fechamento da fatura que vence no mês", () => {
    expect(fechamentoDaFatura("2026-11", 30, 6)).toBe("2026-10-30");
    expect(fechamentoDaFatura("2026-11", 3, 10)).toBe("2026-11-03");
    expect(fechamentoDaFatura("2027-03", 30, 6)).toBe("2027-02-28");
  });

  it("parcelas: centavos que sobram vão na primeira, uma fatura depois da outra", () => {
    expect(dividirParcelas(100_00, 3)).toEqual([33_34, 33_33, 33_33]);
    expect(dividirParcelas(120_00, 12).every((v) => v === 10_00)).toBe(true);
    const plano = planejarCompra(1_000_00, 3, "2026-10-29", 30, 6);
    expect(plano.map((p) => p.mesFatura)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(plano.reduce((a, p) => a + p.valor, 0)).toBe(1_000_00);
    expect(() => dividirParcelas(10_00, 0)).toThrow();
  });

  it("conferência: positivo é o que falta lançar", () => {
    expect(diferencaConferencia(3_000_00, 2_500_00)).toBe(500_00);
    expect(diferencaConferencia(2_500_00, 2_500_00)).toBe(0);
  });
});

describe("Casa: resumo do mês", () => {
  const base = { faturas: [], gastosAvulsos: 0, anterior: 0 };

  it("meta de retirada cobre o próprio dízimo (÷ 0,9)", () => {
    const r = resumoCasa({
      ...base,
      contas: [{ valor: 7_071_54, tipo: "normal", pago: false }, { valor: 0, tipo: "dizimo", pago: false, percentual: 1000 }],
      retiradas: 1_000_00,
      outrasEntradas: 2_000_00,
    });
    expect(r.metaRetirada).toBe(5_635_04);
    expect(r.dizimo).toBe(563_50);
    expect(r.precisa).toBe(7_071_54 + 563_50);
    expect(r.entrou).toBe(3_000_00);
    expect(r.faltaEntrar).toBe(r.precisa - 3_000_00);
    // Retirando exatamente a meta, o mês fecha no zero (diferença de arredondamento de no máximo 1 centavo).
    const fechado = resumoCasa({
      ...base,
      contas: [{ valor: 7_071_54, tipo: "normal", pago: false }, { valor: 0, tipo: "dizimo", pago: false, percentual: 1000 }],
      retiradas: r.metaRetirada,
      outrasEntradas: 2_000_00,
    });
    expect(Math.abs(fechado.resultado)).toBeLessThanOrEqual(1);
  });

  it("dízimo pago vale o valor pago e a meta deixa de dividir por 0,9", () => {
    const r = resumoCasa({ ...base, contas: [{ valor: 1_000_00, tipo: "normal", pago: true, valorPago: 1_000_00 }, { valor: 0, tipo: "dizimo", pago: true, valorPago: 850_00 }], retiradas: 8_500_00, outrasEntradas: 0 });
    expect(r.dizimo).toBe(850_00);
    expect(r.dizimoPago).toBe(true);
    expect(r.metaRetirada).toBe(1_850_00);
    expect(r.resultado).toBe(8_500_00 - 1_850_00);
  });

  it("retirada acima da meta: dízimo é 10% do que entrou", () => {
    const r = resumoCasa({ ...base, contas: [{ valor: 900_00, tipo: "normal", pago: false }, { valor: 0, tipo: "dizimo", pago: false, percentual: 1000 }], retiradas: 2_000_00, outrasEntradas: 0 });
    expect(r.metaRetirada).toBe(1_000_00);
    expect(r.dizimo).toBe(200_00);
    expect(dizimoSugerido(8_500_00)).toBe(850_00);
  });

  it("falta trazida entra no precisa; sobra deixada na conta entra no que entrou", () => {
    const falta = resumoCasa({ ...base, contas: [{ valor: 1_000_00, tipo: "normal", pago: false }], retiradas: 0, outrasEntradas: 1_000_00, anterior: -441_14 });
    expect(falta.precisa).toBe(1_441_14);
    expect(falta.resultado).toBe(-441_14);
    const sobra = resumoCasa({ ...base, contas: [{ valor: 1_000_00, tipo: "normal", pago: false }], retiradas: 0, outrasEntradas: 1_000_00, anterior: 338_85 });
    expect(sobra.entrou).toBe(1_338_85);
    expect(sobra.resultado).toBe(338_85);
  });

  it("faturas e gastos no débito entram no precisa", () => {
    const r = resumoCasa({ contas: [], faturas: [2_939_11, 0], gastosAvulsos: 89_90, retiradas: 0, outrasEntradas: 0, anterior: 0 });
    expect(r.precisa).toBe(3_029_01);
  });

  it("opções do fechamento", () => {
    expect(opcoesFechamento(338_85)).toEqual(["reserva", "conta"]);
    expect(opcoesFechamento(-441_14)).toEqual(["resgatar", "proximo"]);
    expect(carregaParaProximo(-441_14, "proximo")).toBe(-441_14);
    expect(carregaParaProximo(-441_14, "resgatar")).toBe(0);
    expect(carregaParaProximo(338_85, "reserva")).toBe(0);
    expect(carregaParaProximo(338_85, "conta")).toBe(338_85);
  });
});

describe("Clados", () => {
  it("pode retirar = saldo − comprometido − reserva mínima, nunca negativo", () => {
    expect(podeRetirar(6_200_00, 918_77, 2_000_00)).toBe(3_281_23);
    expect(podeRetirar(1_000_00, 918_77, 2_000_00)).toBe(0);
    expect(excessoRetirada(4_000_00, 3_281_23)).toBe(718_77);
    expect(excessoRetirada(2_000_00, 3_281_23)).toBe(0);
  });

  it("faturamento necessário e limite do MEI", () => {
    expect(faturamentoNecessario(5_635_04, 918_77)).toBe(6_553_81);
    expect(situacaoMei(64_800_00).alerta).toBe(true);
    expect(situacaoMei(1_500_00).alerta).toBe(false);
  });

  it("horas", () => {
    expect(valorHoras(150, 150_00)).toBe(375_00);
    expect(formatHoras(150)).toBe("2h 30");
    expect(formatHoras(45)).toBe("45min");
  });
});

describe("formatação", () => {
  it("dinheiro", () => {
    expect(brl(620_000)).toBe("R$ 6.200,00");
    expect(brl(-71_877)).toBe("−R$ 718,77");
    expect(brlShort(328_123)).toBe("R$ 3.281");
    expect(signed(150_000)).toBe("+1.500");
    expect(signed(-25_856)).toBe("−258,56");
    expect(parseBRL("1.234,56")).toBe(123_456);
    expect(parseBRL("89,9")).toBe(8_990);
    expect(parseBRL("2.000")).toBe(200_000);
    expect(parseBRL("abc")).toBeNull();
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});
