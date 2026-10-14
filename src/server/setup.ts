import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { cartoes, categorias, espacos } from "@/db/schema";
import { CARTAO_PJ, CARTOES_CASA, CATEGORIAS_CASA, CATEGORIAS_CLADOS } from "@/db/planilha";
import type { ISODate } from "@/lib/dates";
import type { Cents } from "@/lib/money";

export interface SetupInput {
  cladosInicio: ISODate;
  cladosSaldo: Cents;
  reservaMinima: Cents;
  casaInicio: ISODate;
  casaSaldo: Cents;
  reservaInicial: Cents;
  diaPagar?: number;
  /** Cartão PJ fica na Casa (como era na planilha) em vez de na Clados. */
  pjNaCasa?: boolean;
}

/** Cria os dois espaços, as categorias e os cartões. */
export async function criarEspacos(db: DB, i: SetupInput) {
  const [clados] = await db
    .insert(espacos)
    .values({ tipo: "clados", nome: "Clados", saldoInicial: i.cladosSaldo, dataInicio: i.cladosInicio, reservaMinima: i.reservaMinima, diaPagar: i.diaPagar ?? 5 })
    .returning();
  const [casa] = await db
    .insert(espacos)
    .values({ tipo: "casa", nome: "Casa", saldoInicial: i.casaSaldo, dataInicio: i.casaInicio, reservaInicial: i.reservaInicial, diaPagar: i.diaPagar ?? 5 })
    .returning();
  await db.insert(categorias).values(CATEGORIAS_CASA.map((nome, ordem) => ({ espacoId: casa.id, nome, ordem })));
  await db.insert(categorias).values(CATEGORIAS_CLADOS.map((nome, ordem) => ({ espacoId: clados.id, nome, ordem })));
  await db.insert(cartoes).values(CARTOES_CASA.map((c, ordem) => ({ ...c, espacoId: casa.id, ordem })));
  await db.insert(cartoes).values({
    ...CARTAO_PJ,
    nome: i.pjNaCasa ? "Cartão PJ" : CARTAO_PJ.nome,
    espacoId: i.pjNaCasa ? casa.id : clados.id,
    ordem: 9,
  });
  return { clados, casa };
}

export async function cartaoPorNome(db: DB, nome: string) {
  const [c] = await db.select().from(cartoes).where(eq(cartoes.nome, nome));
  if (!c) throw new Error(`Cartão ${nome} não existe`);
  return c;
}

export async function categoriaPorNome(db: DB, espacoId: number, nome: string) {
  const rows = await db.select().from(categorias).where(eq(categorias.espacoId, espacoId));
  return rows.find((r) => r.nome === nome) ?? null;
}
