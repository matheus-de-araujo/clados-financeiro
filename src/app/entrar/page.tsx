import { redirect } from "next/navigation";
import { isDemo } from "@/db";
import { DEMO_USERS } from "@/db/seed";
import { getSessao } from "@/server/sessao";
import { FormEntrar } from "./form";

export const metadata = { title: "Entrar · Financeiro" };

export default async function Entrar() {
  const s = await getSessao();
  if (s) redirect(`/${s.padrao}`);
  return (
    <main className="tela sem-nav px-4" style={{ paddingTop: "calc(48px + env(safe-area-inset-top))" }}>
      <div className="flex h-14 w-14 items-center justify-center rounded-[16px] text-[22px] font-semibold" style={{ background: "var(--color-mata)", color: "var(--color-agua)" }}>
        F
      </div>
      <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.6px]">Financeiro</h1>
      <p className="mt-1 text-[15px] text-cinza">Clados e Casa, cada um no seu lugar.</p>
      <FormEntrar demo={isDemo ? DEMO_USERS.map((u) => ({ nome: u.name, email: u.email, senha: u.password })) : null} />
    </main>
  );
}
