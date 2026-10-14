// Dados das planilhas mensais da Casa (pasta do Drive), em centavos.
// "08 - AGOSTO paga em SETEMBRO" vira setembro de 2026, e assim por diante.

export interface ContaPlanilha {
  chave: string;
  valor: number;
}

export interface MesPlanilha {
  mes: string;
  entradas: { descricao: string; valor: number; retirada?: boolean }[];
  contas: ContaPlanilha[];
  cartoes: { cartao: string; compras: { descricao: string; valor: number; categoria?: string }[] }[];
  resultado: number;
}

/** Contas fixas da Casa como estão na planilha de outubro/2026 (parcelas no mês de novembro). */
export const CONTAS_CASA = [
  { chave: "energia", nome: "Energia", dia: 2, valor: 300_00 },
  { chave: "dizimo", nome: "Dízimo", dia: 5, valor: 0, tipo: "dizimo" as const },
  { chave: "caixa", nome: "Casa · Caixa", dia: 5, valor: 674_00, parcelaNov: 47, total: 360 },
  { chave: "seguro", nome: "Seguro do carro", dia: 10, valor: 176_40 },
  { chave: "condominio", nome: "Condomínio", dia: 10, valor: 430_80 },
  { chave: "gas", nome: "Gás", dia: 17, valor: 52_08 },
  { chave: "internet", nome: "Internet", dia: 20, valor: 99_99 },
  { chave: "tenda", nome: "Tenda · entrada", dia: 25, valor: 256_88, parcelaNov: 49, total: 60 },
  { chave: "carro", nome: "Carro", dia: 25, valor: 597_34, parcelaNov: 26, total: 48 },
  { chave: "irpf", nome: "IRPF", dia: 31, valor: 237_03, parcelaNov: 6, total: 8 },
];

/** Antes da separação, o DAS do MEI estava nas contas da Casa. */
export const CONTA_MEI = { chave: "mei", nome: "MEI do Matheus", dia: 20, valor: 86_05 };
export const CONTA_RESERVA = { chave: "reserva", nome: "Guardar na reserva", dia: 5, valor: 708_80, tipo: "reserva" as const };

export const SETEMBRO: MesPlanilha = {
  mes: "2026-09",
  entradas: [
    { descricao: "GF", valor: 8_340_00 },
    { descricao: "Matheus", valor: 8_500_00, retirada: true },
  ],
  contas: [
    { chave: "mei", valor: 86_05 },
    { chave: "dizimo", valor: 850_00 },
    { chave: "seguro", valor: 179_20 },
    { chave: "condominio", valor: 430_80 },
    { chave: "tenda", valor: 256_88 },
    { chave: "caixa", valor: 632_50 },
    { chave: "energia", valor: 214_35 },
    { chave: "internet", valor: 99_99 },
    { chave: "gas", valor: 47_62 },
    { chave: "carro", valor: 597_34 },
    { chave: "irpf", valor: 242_52 },
  ],
  cartoes: [
    { cartao: "Nubank Matheus", compras: [{ descricao: "Compras de agosto", valor: 2_780_22 }] },
    { cartao: "Cartão PJ", compras: [{ descricao: "Compras de agosto", valor: 8_344_50 }] },
    { cartao: "Nubank Dayane", compras: [{ descricao: "Compras de agosto", valor: 2_519_17 }] },
  ],
  resultado: -441_14,
};

export const OUTUBRO: MesPlanilha = {
  mes: "2026-10",
  entradas: [{ descricao: "Matheus", valor: 8_500_00, retirada: true }],
  contas: [
    { chave: "energia", valor: 229_29 },
    { chave: "dizimo", valor: 850_00 },
    { chave: "caixa", valor: 633_57 },
    { chave: "seguro", valor: 185_20 },
    { chave: "condominio", valor: 430_80 },
    { chave: "gas", valor: 47_59 },
    { chave: "mei", valor: 86_05 },
    { chave: "internet", valor: 99_99 },
    { chave: "tenda", valor: 256_88 },
    { chave: "carro", valor: 597_34 },
    { chave: "irpf", valor: 247_00 },
  ],
  cartoes: [
    { cartao: "Nubank Matheus", compras: [{ descricao: "Compras de setembro", valor: 3_854_00 }] },
    { cartao: "Cartão PJ", compras: [{ descricao: "Compras de setembro", valor: 940_59 }] },
    { cartao: "Nubank Dayane", compras: [{ descricao: "Compras de setembro", valor: 2_840_07 }] },
  ],
  resultado: -2_798_37,
};

export const NOVEMBRO: MesPlanilha = {
  mes: "2026-11",
  entradas: [{ descricao: "Matheus", valor: 8_500_00, retirada: true }],
  contas: [
    { chave: "reserva", valor: 708_80 },
    { chave: "energia", valor: 300_00 },
    { chave: "dizimo", valor: 850_00 },
    { chave: "caixa", valor: 674_00 },
    { chave: "seguro", valor: 176_40 },
    { chave: "condominio", valor: 430_80 },
    { chave: "gas", valor: 52_08 },
    { chave: "mei", valor: 86_05 },
    { chave: "internet", valor: 99_99 },
    { chave: "tenda", valor: 256_88 },
    { chave: "carro", valor: 597_34 },
    { chave: "irpf", valor: 237_03 },
  ],
  cartoes: [
    { cartao: "Nubank Matheus", compras: [] },
    {
      cartao: "Cartão PJ",
      compras: [
        { descricao: "Canva · 2/12", valor: 24_16, categoria: "Ferramentas" },
        { descricao: "Óculos · 10/10", valor: 117_00 },
        { descricao: "edz Coo · 9/12", valor: 258_56, categoria: "Ferramentas" },
        { descricao: "Celular · 5/8", valor: 352_95 },
      ],
    },
    {
      cartao: "Nubank Dayane",
      compras: [
        { descricao: "Sofia", valor: 781_44, categoria: "Sofia" },
        { descricao: "Gasolina", valor: 698_63, categoria: "Gasolina" },
        { descricao: "Jantar, lanches e lazer", valor: 307_31, categoria: "Jantar, lanches e lazer" },
        { descricao: "Supermercado", valor: 282_58, categoria: "Supermercado" },
        { descricao: "Farmácia", valor: 83_49, categoria: "Farmácia" },
        { descricao: "Apple", valor: 99_90, categoria: "Assinaturas" },
        { descricao: "SQSP", valor: 52_77, categoria: "Assinaturas" },
        { descricao: "Google One", valor: 9_99, categoria: "Assinaturas" },
        { descricao: "Laser · 9/10", valor: 110_00, categoria: "Desejos" },
        { descricao: "Berço · 6/10", valor: 51_87, categoria: "Desejos" },
        { descricao: "Casa", valor: 68_98, categoria: "Casa" },
        { descricao: "Sem descrição", valor: 392_15 },
      ],
    },
  ],
  resultado: 338_85,
};

export const MESES_PLANILHA = [SETEMBRO, OUTUBRO, NOVEMBRO];

/** Cartões: dias de fechamento e vencimento padrão (pendência para o Matheus confirmar). */
export const CARTOES_CASA = [
  { nome: "Nubank Dayane", dono: "Dayane", sigla: "D", diaFecha: 3, diaVence: 10 },
  { nome: "Nubank Matheus", dono: "Matheus", sigla: "M", diaFecha: 13, diaVence: 20 },
  { nome: "Mercado Pago", dono: null, sigla: "MP", diaFecha: 3, diaVence: 10 },
];
export const CARTAO_PJ = { nome: "Cartão Clados", dono: "Clados", sigla: "C", diaFecha: 30, diaVence: 6, limite: 14_350_00 };

export const CATEGORIAS_CASA = ["Supermercado", "Gasolina", "Jantar, lanches e lazer", "Farmácia", "Sofia", "Casa", "Desejos", "Assinaturas", "Outros"];
export const CATEGORIAS_CLADOS = ["Ferramentas", "Cursos", "Equipamento", "Impostos", "Outros"];
