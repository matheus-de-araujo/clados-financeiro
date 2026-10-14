CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"espaco_id" integer NOT NULL,
	"nome" text NOT NULL,
	"dono" text,
	"sigla" text NOT NULL,
	"dia_fecha" integer NOT NULL,
	"dia_vence" integer NOT NULL,
	"limite" integer,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"espaco_id" integer NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chaves_atalho" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"hash" text NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"telefone" text,
	"desde" date NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contas_fixas" (
	"id" serial PRIMARY KEY NOT NULL,
	"espaco_id" integer NOT NULL,
	"nome" text NOT NULL,
	"dia" integer NOT NULL,
	"valor" integer DEFAULT 0 NOT NULL,
	"tipo" text DEFAULT 'normal' NOT NULL,
	"percentual" integer,
	"cartao_id" integer,
	"categoria_id" integer,
	"forma" text,
	"parcela_inicio" integer,
	"parcelas_total" integer,
	"inicio_mes" text NOT NULL,
	"fim_mes" text,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contas_mes" (
	"id" serial PRIMARY KEY NOT NULL,
	"espaco_id" integer NOT NULL,
	"conta_fixa_id" integer,
	"mes" text NOT NULL,
	"nome" text NOT NULL,
	"vencimento" date NOT NULL,
	"valor" integer NOT NULL,
	"tipo" text DEFAULT 'normal' NOT NULL,
	"percentual" integer,
	"forma" text,
	"parcela" integer,
	"parcelas" integer,
	"pago_em" date,
	"valor_pago" integer,
	"lancamento_id" integer
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text NOT NULL,
	"valor_total" integer,
	"valor_hora" integer,
	"mensalidade" integer,
	"dia" integer,
	"inicio_mes" text,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "espacos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"nome" text NOT NULL,
	"saldo_inicial" integer DEFAULT 0 NOT NULL,
	"data_inicio" date NOT NULL,
	"reserva_minima" integer DEFAULT 0 NOT NULL,
	"reserva_inicial" integer DEFAULT 0 NOT NULL,
	"dia_pagar" integer DEFAULT 5 NOT NULL,
	CONSTRAINT "espacos_tipo_unique" UNIQUE("tipo")
);
--> statement-breakpoint
CREATE TABLE "faturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"cartao_id" integer NOT NULL,
	"mes" text NOT NULL,
	"vencimento" date NOT NULL,
	"pago_em" date,
	"valor_pago" integer,
	"lancamento_id" integer,
	"conferido_valor" integer,
	"conferido_em" date
);
--> statement-breakpoint
CREATE TABLE "fechamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"espaco_id" integer NOT NULL,
	"mes" text NOT NULL,
	"resultado" integer NOT NULL,
	"decisao" text NOT NULL,
	"carrega" integer DEFAULT 0 NOT NULL,
	"fechado_em" timestamp DEFAULT now() NOT NULL,
	"fechado_por" text
);
--> statement-breakpoint
CREATE TABLE "horas" (
	"id" serial PRIMARY KEY NOT NULL,
	"contrato_id" integer NOT NULL,
	"data" date NOT NULL,
	"minutos" integer NOT NULL,
	"descricao" text NOT NULL,
	"recebivel_id" integer
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"espaco_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"valor" integer NOT NULL,
	"data" date NOT NULL,
	"descricao" text NOT NULL,
	"categoria_id" integer,
	"cartao_id" integer,
	"mes_fatura" text,
	"parcela" integer,
	"parcelas" integer,
	"grupo" text,
	"origem" text DEFAULT 'manual' NOT NULL,
	"conta_mes_id" integer,
	"conta_fixa_id" integer,
	"mes_ref" text,
	"recebivel_id" integer,
	"cliente_id" integer,
	"retirada_id" integer,
	"criado_por" text,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membros" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"espaco_id" integer NOT NULL,
	"papel" text NOT NULL,
	"padrao" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recebiveis" (
	"id" serial PRIMARY KEY NOT NULL,
	"contrato_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"descricao" text NOT NULL,
	"valor" integer NOT NULL,
	"vencimento" date NOT NULL,
	"mes_ref" text,
	"parcela" integer,
	"parcelas" integer,
	"recebido_em" date,
	"nf" boolean DEFAULT false NOT NULL,
	"lancamento_id" integer
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartoes" ADD CONSTRAINT "cartoes_espaco_id_espacos_id_fk" FOREIGN KEY ("espaco_id") REFERENCES "public"."espacos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_espaco_id_espacos_id_fk" FOREIGN KEY ("espaco_id") REFERENCES "public"."espacos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaves_atalho" ADD CONSTRAINT "chaves_atalho_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas_fixas" ADD CONSTRAINT "contas_fixas_espaco_id_espacos_id_fk" FOREIGN KEY ("espaco_id") REFERENCES "public"."espacos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas_fixas" ADD CONSTRAINT "contas_fixas_cartao_id_cartoes_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas_fixas" ADD CONSTRAINT "contas_fixas_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas_mes" ADD CONSTRAINT "contas_mes_espaco_id_espacos_id_fk" FOREIGN KEY ("espaco_id") REFERENCES "public"."espacos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas_mes" ADD CONSTRAINT "contas_mes_conta_fixa_id_contas_fixas_id_fk" FOREIGN KEY ("conta_fixa_id") REFERENCES "public"."contas_fixas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_cartao_id_cartoes_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamentos" ADD CONSTRAINT "fechamentos_espaco_id_espacos_id_fk" FOREIGN KEY ("espaco_id") REFERENCES "public"."espacos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horas" ADD CONSTRAINT "horas_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horas" ADD CONSTRAINT "horas_recebivel_id_recebiveis_id_fk" FOREIGN KEY ("recebivel_id") REFERENCES "public"."recebiveis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_espaco_id_espacos_id_fk" FOREIGN KEY ("espaco_id") REFERENCES "public"."espacos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_cartao_id_cartoes_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros" ADD CONSTRAINT "membros_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros" ADD CONSTRAINT "membros_espaco_id_espacos_id_fk" FOREIGN KEY ("espaco_id") REFERENCES "public"."espacos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebiveis" ADD CONSTRAINT "recebiveis_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebiveis" ADD CONSTRAINT "recebiveis_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contas_mes_fixa_mes" ON "contas_mes" USING btree ("conta_fixa_id","mes");--> statement-breakpoint
CREATE INDEX "contas_mes_espaco_mes" ON "contas_mes" USING btree ("espaco_id","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "faturas_cartao_mes" ON "faturas" USING btree ("cartao_id","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "fechamentos_espaco_mes" ON "fechamentos" USING btree ("espaco_id","mes");--> statement-breakpoint
CREATE INDEX "lanc_espaco_data" ON "lancamentos" USING btree ("espaco_id","data");--> statement-breakpoint
CREATE INDEX "lanc_cartao_fatura" ON "lancamentos" USING btree ("cartao_id","mes_fatura");--> statement-breakpoint
CREATE UNIQUE INDEX "lanc_fixa_mes" ON "lancamentos" USING btree ("conta_fixa_id","mes_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "membros_user_espaco" ON "membros" USING btree ("user_id","espaco_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recebiveis_suporte_mes" ON "recebiveis" USING btree ("contrato_id","mes_ref");