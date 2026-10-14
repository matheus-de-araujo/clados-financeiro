import { sql } from "drizzle-orm";
import { boolean, date, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// ---------- Login (tabelas do Better Auth) ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------- Espaços e acesso ----------

/** tipo: "clados" | "casa" */
export const espacos = pgTable("espacos", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull().unique(),
  nome: text("nome").notNull(),
  saldoInicial: integer("saldo_inicial").notNull().default(0),
  dataInicio: date("data_inicio", { mode: "string" }).notNull(),
  reservaMinima: integer("reserva_minima").notNull().default(0),
  reservaInicial: integer("reserva_inicial").notNull().default(0),
  diaPagar: integer("dia_pagar").notNull().default(5),
});

/** papel: "edita" | "ve" */
export const membros = pgTable(
  "membros",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    espacoId: integer("espaco_id").notNull().references(() => espacos.id),
    papel: text("papel").notNull(),
    padrao: boolean("padrao").notNull().default(false),
  },
  (t) => [uniqueIndex("membros_user_espaco").on(t.userId, t.espacoId)],
);

export const cartoes = pgTable("cartoes", {
  id: serial("id").primaryKey(),
  espacoId: integer("espaco_id").notNull().references(() => espacos.id),
  nome: text("nome").notNull(),
  dono: text("dono"),
  sigla: text("sigla").notNull(),
  diaFecha: integer("dia_fecha").notNull(),
  diaVence: integer("dia_vence").notNull(),
  limite: integer("limite"),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
});

export const categorias = pgTable("categorias", {
  id: serial("id").primaryKey(),
  espacoId: integer("espaco_id").notNull().references(() => espacos.id),
  nome: text("nome").notNull(),
  ordem: integer("ordem").notNull().default(0),
});

// ---------- Clados: clientes ----------

export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  telefone: text("telefone"),
  desde: date("desde", { mode: "string" }).notNull(),
  ativo: boolean("ativo").notNull().default(true),
});

/** tipo: "projeto" | "hora" | "suporte" */
export const contratos = pgTable("contratos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientes.id),
  tipo: text("tipo").notNull(),
  descricao: text("descricao").notNull(),
  valorTotal: integer("valor_total"),
  valorHora: integer("valor_hora"),
  mensalidade: integer("mensalidade"),
  dia: integer("dia"),
  inicioMes: text("inicio_mes"),
  ativo: boolean("ativo").notNull().default(true),
});

export const recebiveis = pgTable(
  "recebiveis",
  {
    id: serial("id").primaryKey(),
    contratoId: integer("contrato_id").notNull().references(() => contratos.id),
    clienteId: integer("cliente_id").notNull().references(() => clientes.id),
    descricao: text("descricao").notNull(),
    valor: integer("valor").notNull(),
    vencimento: date("vencimento", { mode: "string" }).notNull(),
    mesRef: text("mes_ref"),
    parcela: integer("parcela"),
    parcelas: integer("parcelas"),
    recebidoEm: date("recebido_em", { mode: "string" }),
    nf: boolean("nf").notNull().default(false),
    lancamentoId: integer("lancamento_id"),
  },
  (t) => [uniqueIndex("recebiveis_suporte_mes").on(t.contratoId, t.mesRef)],
);

export const horas = pgTable("horas", {
  id: serial("id").primaryKey(),
  contratoId: integer("contrato_id").notNull().references(() => contratos.id),
  data: date("data", { mode: "string" }).notNull(),
  minutos: integer("minutos").notNull(),
  descricao: text("descricao").notNull(),
  recebivelId: integer("recebivel_id").references(() => recebiveis.id),
});

// ---------- Dinheiro ----------

/**
 * Todo dinheiro que entra ou sai. `valor` é sempre positivo; o efeito vem do tipo:
 * entrada (+ conta), saida (− conta), compra (vai para a fatura do cartão),
 * retirada (− conta da Clados; a Casa recebe uma "entrada" com retiradaId),
 * fatura (pagamento de fatura, − conta), guardar (− conta, + reserva), resgatar (+ conta, − reserva).
 */
export const lancamentos = pgTable(
  "lancamentos",
  {
    id: serial("id").primaryKey(),
    espacoId: integer("espaco_id").notNull().references(() => espacos.id),
    tipo: text("tipo").notNull(),
    valor: integer("valor").notNull(),
    data: date("data", { mode: "string" }).notNull(),
    descricao: text("descricao").notNull(),
    categoriaId: integer("categoria_id").references(() => categorias.id),
    cartaoId: integer("cartao_id").references(() => cartoes.id),
    mesFatura: text("mes_fatura"),
    parcela: integer("parcela"),
    parcelas: integer("parcelas"),
    grupo: text("grupo"),
    origem: text("origem").notNull().default("manual"),
    contaMesId: integer("conta_mes_id"),
    contaFixaId: integer("conta_fixa_id"),
    mesRef: text("mes_ref"),
    recebivelId: integer("recebivel_id"),
    clienteId: integer("cliente_id"),
    retiradaId: integer("retirada_id"),
    criadoPor: text("criado_por"),
    criadoEm: timestamp("criado_em").notNull().defaultNow(),
  },
  (t) => [
    index("lanc_espaco_data").on(t.espacoId, t.data),
    index("lanc_cartao_fatura").on(t.cartaoId, t.mesFatura),
    uniqueIndex("lanc_fixa_mes").on(t.contaFixaId, t.mesRef),
  ],
);

/** tipo: "normal" | "dizimo" | "reserva". Com cartaoId, vira uma compra todo mês no cartão. */
export const contasFixas = pgTable("contas_fixas", {
  id: serial("id").primaryKey(),
  espacoId: integer("espaco_id").notNull().references(() => espacos.id),
  nome: text("nome").notNull(),
  dia: integer("dia").notNull(),
  valor: integer("valor").notNull().default(0),
  tipo: text("tipo").notNull().default("normal"),
  percentual: integer("percentual"),
  cartaoId: integer("cartao_id").references(() => cartoes.id),
  categoriaId: integer("categoria_id").references(() => categorias.id),
  forma: text("forma"),
  parcelaInicio: integer("parcela_inicio"),
  parcelasTotal: integer("parcelas_total"),
  inicioMes: text("inicio_mes").notNull(),
  fimMes: text("fim_mes"),
  ativo: boolean("ativo").notNull().default(true),
});

export const contasMes = pgTable(
  "contas_mes",
  {
    id: serial("id").primaryKey(),
    espacoId: integer("espaco_id").notNull().references(() => espacos.id),
    contaFixaId: integer("conta_fixa_id").references(() => contasFixas.id),
    mes: text("mes").notNull(),
    nome: text("nome").notNull(),
    vencimento: date("vencimento", { mode: "string" }).notNull(),
    valor: integer("valor").notNull(),
    tipo: text("tipo").notNull().default("normal"),
    percentual: integer("percentual"),
    forma: text("forma"),
    parcela: integer("parcela"),
    parcelas: integer("parcelas"),
    pagoEm: date("pago_em", { mode: "string" }),
    valorPago: integer("valor_pago"),
    lancamentoId: integer("lancamento_id"),
  },
  (t) => [uniqueIndex("contas_mes_fixa_mes").on(t.contaFixaId, t.mes), index("contas_mes_espaco_mes").on(t.espacoId, t.mes)],
);

export const faturas = pgTable(
  "faturas",
  {
    id: serial("id").primaryKey(),
    cartaoId: integer("cartao_id").notNull().references(() => cartoes.id),
    mes: text("mes").notNull(),
    vencimento: date("vencimento", { mode: "string" }).notNull(),
    pagoEm: date("pago_em", { mode: "string" }),
    valorPago: integer("valor_pago"),
    lancamentoId: integer("lancamento_id"),
    conferidoValor: integer("conferido_valor"),
    conferidoEm: date("conferido_em", { mode: "string" }),
  },
  (t) => [uniqueIndex("faturas_cartao_mes").on(t.cartaoId, t.mes)],
);

/** decisao: "reserva" | "conta" | "resgatar" | "proximo" */
export const fechamentos = pgTable(
  "fechamentos",
  {
    id: serial("id").primaryKey(),
    espacoId: integer("espaco_id").notNull().references(() => espacos.id),
    mes: text("mes").notNull(),
    resultado: integer("resultado").notNull(),
    decisao: text("decisao").notNull(),
    carrega: integer("carrega").notNull().default(0),
    fechadoEm: timestamp("fechado_em").notNull().defaultNow(),
    fechadoPor: text("fechado_por"),
  },
  (t) => [uniqueIndex("fechamentos_espaco_mes").on(t.espacoId, t.mes)],
);

/** Chave pessoal do Atalho do iPhone (etapa 2). Só o hash fica guardado. */
export const chavesAtalho = pgTable("chaves_atalho", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  criadoEm: timestamp("criado_em").notNull().default(sql`now()`),
});
