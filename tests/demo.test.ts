// Os dados de demonstração montam o estado esperado em 14/10/2026.
import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryDb, type DB } from "@/db";
import { seedDemo } from "@/db/seed";
import { mesCasa } from "@/server/casa";
import { mesClados } from "@/server/clados";
import { faturaDoMes } from "@/server/casa";
import { cartaoPorNome } from "@/server/setup";

let db: DB;
const HOJE = "2026-10-14";
beforeAll(async () => {
  db = await createMemoryDb();
  await seedDemo(db);
});

describe("demonstração", () => {
  it("setembro fechado com −R$ 441,14 levado para outubro", async () => {
    const s = await mesCasa(db, "2026-09", HOJE);
    expect(s.resultadoDoMes).toBe(-441_14);
    expect(s.fechamento?.decisao).toBe("proximo");
  });

  it("outubro: mesmo total da planilha, parte paga até hoje", async () => {
    const o = await mesCasa(db, "2026-10", HOJE);
    expect(o.resultadoDoMes).toBe(-2_798_37);
    expect(o.resumo.resultado).toBe(-3_239_51);
    expect(o.contas.some((c) => !c.pagoEm)).toBe(true);
    expect(o.faturas.find((f) => f.cartao.nome === "Nubank Dayane")?.pagoEm).toBe("2026-10-10");
  });

  it("novembro já no modelo novo: fatura da Dayane, reserva e dízimo calculado", async () => {
    const n = await mesCasa(db, "2026-11", HOJE);
    expect(n.faturas.find((f) => f.cartao.nome === "Nubank Dayane")?.total).toBe(2_939_11);
    expect(n.contas.find((c) => c.tipo === "reserva")?.valor).toBe(708_80);
    expect(n.contas.find((c) => c.nome === "MEI do Matheus")).toBeUndefined();
    expect(n.resumo.metaRetirada).toBeGreaterThan(0);
  });

  it("Clados: saldo, fatura de novembro igual ao cartão PJ e cliente atrasado", async () => {
    const c = await mesClados(db, "2026-10", HOJE);
    expect(c.saldo).toBe(7_700_00);
    const cc = await cartaoPorNome(db, "Cartão Clados");
    expect((await faturaDoMes(db, cc, "2026-11")).total).toBe(752_67);
    expect(c.atrasados.map((a) => a.cliente.nome)).toContain("Alfa Ltda");
    expect(c.horasAbertas.map((h) => h.cliente.nome).sort()).toEqual(["Beta Comércio", "Delta Engenharia"]);
    expect(c.podeRetirar).toBe(7_700_00 - 752_67 - 2_000_00);
  });
});
