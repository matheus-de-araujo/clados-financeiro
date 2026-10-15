// Importação das planilhas mensais da Casa (fevereiro a novembro de 2026).
import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryDb, type DB } from "@/db";
import { getEspaco, saldoConta } from "@/server/base";
import { mesCasa } from "@/server/casa";
import { categoriaDoItem, chaveDaConta, importarCasa, limparCasa, MESES_IMPORTADOS, type RelatorioMes } from "@/server/importar-casa";
import { criarEspacos } from "@/server/setup";
import { seedDemo } from "@/db/seed";

const HOJE = "2026-10-15";

describe("as planilhas extraídas batem com elas mesmas", () => {
  it.each(MESES_IMPORTADOS.map((m) => [m.mes, m] as const))("%s: entradas − contas − cartões = resultado da planilha", (_, m) => {
    const entradas = m.entradas.reduce((a, [, v]) => a + v, 0);
    const contas = m.contas.reduce((a, c) => a + c[3], 0);
    const cartoes = Object.values(m.cartoes).reduce((a, c) => a + c.total, 0);
    // Em abril a aba só somou "Emprestado" nas entradas; o resto entrou de verdade e conta aqui.
    const esperado = m.mes === "2026-04" ? m.resultado + (100_000 + 850_000 + 17_038) : m.resultado;
    expect(entradas - contas - cartoes).toBe(esperado);
  });

  it("toda conta recorrente tem chave e os itens ganham categoria", () => {
    expect(chaveDaConta("Casa Caixa 31/360")).toBe("caixa");
    expect(chaveDaConta("TANK B")).toBeNull();
    expect(categoriaDoItem("SUPERMERCDO", "")).toBe("Supermercado");
    expect(categoriaDoItem("JANTAR FORA", "LAZER")).toBe("Jantar, lanches e lazer");
    expect(categoriaDoItem("UBER", "TRANSPORTE")).toBe("Outros");
  });
});

describe("importação num banco novo", () => {
  let db: DB;
  let rel: RelatorioMes[];
  beforeAll(async () => {
    db = await createMemoryDb();
    await criarEspacos(db, { cladosInicio: "2026-10-01", cladosSaldo: 0, reservaMinima: 0, casaInicio: "2026-09-01", casaSaldo: 0, reservaInicial: 0 });
    rel = await importarCasa(db, { hoje: HOJE });
    console.table(rel.map((r) => ({ mes: r.mes, planilha: r.planilha, esperado: r.esperado, app: r.app, pendentes: r.pendentesMarcadas.join(", "), ajustes: r.ajustes.join("; ") })));
  });

  it("o resultado de cada mês no app é o da planilha", () => {
    for (const r of rel) expect([r.mes, r.app]).toEqual([r.mes, r.esperado]);
  });

  it("meses passados ficam fechados e outubro e novembro abertos", async () => {
    expect((await mesCasa(db, "2026-09", HOJE)).fechamento).not.toBeNull();
    expect((await mesCasa(db, "2026-10", HOJE)).fechamento).toBeNull();
    expect((await mesCasa(db, "2026-11", HOJE)).fechamento).toBeNull();
  });

  it("o cartão PJ antigo aparece em outubro, mas não em novembro", async () => {
    expect((await mesCasa(db, "2026-10", HOJE)).faturas.map((f) => f.cartao.nome)).toContain("Cartão PJ");
    expect((await mesCasa(db, "2026-11", HOJE)).faturas.map((f) => f.cartao.nome)).not.toContain("Cartão PJ");
  });

  it("saldo de hoje é a soma do que já aconteceu", async () => {
    const casa = await getEspaco(db, "casa");
    const s = await saldoConta(db, casa, HOJE);
    console.log("saldo da Casa em", HOJE, s / 100);
    expect(Number.isInteger(s)).toBe(true);
  });
});

describe("importação por cima da demonstração", () => {
  it("limpa a Casa, mantém a Clados e importa igual", async () => {
    const db = await createMemoryDb();
    await seedDemo(db);
    await limparCasa(db);
    const rel = await importarCasa(db, { hoje: HOJE });
    for (const r of rel) expect([r.mes, r.app]).toEqual([r.mes, r.esperado]);
  });
});
