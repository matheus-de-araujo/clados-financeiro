import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emMemoria, getDb, isDemo, schema, type DB } from "@/db";

function build(db: DB) {
  const secret = process.env.BETTER_AUTH_SECRET || (isDemo ? "modo-demonstracao-clados-financeiro-0001" : undefined);
  if (!secret) throw new Error("Defina BETTER_AUTH_SECRET");
  return betterAuth({
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    // Só entra quem foi cadastrado; não há tela de criar conta.
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
    session: {
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
      // O cookie assinado evita ir ao banco conferir a sessão a cada tela. Na demonstração em memória o banco
      // vive em cada servidor, então o cookie vale mais tempo para manter o login entre eles.
      cookieCache: { enabled: true, maxAge: emMemoria ? 60 * 60 * 12 : 60 * 5 },
    },
    trustedOrigins: (req) => {
      const origin = req?.headers.get("origin");
      return origin ? [origin] : [];
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof build>;

const g = globalThis as unknown as { __financeiroAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  if (!g.__financeiroAuth) g.__financeiroAuth = getDb().then(build);
  return g.__financeiroAuth;
}
