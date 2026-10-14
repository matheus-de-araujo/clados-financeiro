// Fluxo real pela interface: retirada, pagar conta, ver a Casa atualizar, e Dayane sem acesso a lançar na Clados.
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? "playwright");
const base = process.argv[2] ?? "http://localhost:3100";
const browser = await chromium.launch();
const ok = (c, m) => { console.log((c ? "OK  " : "FALHOU ") + m); if (!c) process.exitCode = 1; };
async function entrar(quem) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(`${base}/entrar`);
  await p.getByRole("button", { name: quem, exact: true }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60_000 });
  return p;
}
const m = await entrar("Matheus");
ok(new URL(m.url()).pathname === "/clados", "Matheus abre na Clados");
await m.goto(`${base}/clados/retirada`, { waitUntil: "networkidle" });
await m.getByRole("button", { name: "Confirmar retirada" }).click();
await m.waitForURL(`${base}/clados`, { timeout: 30_000 });
await m.waitForLoadState("networkidle");
const txt = await m.textContent("main") ?? (await m.textContent("body"));
ok(/R\$ 3\.240 de R\$ 3\.240/.test(txt.replace(/\s+/g, " ")), "Retirada de R$ 3.240 (sugerida: o que falta) aparece na Clados");
await m.goto(`${base}/casa`, { waitUntil: "networkidle" });
const casa = (await m.textContent("body")).replace(/\s+/g, " ");
ok(casa.includes("R$ 5.189,34"), "Saldo da Casa subiu 3.240 (1.949,34 → 5.189,34)");
await m.goto(`${base}/casa/contas`, { waitUntil: "networkidle" });
await m.getByLabel("Marcar Gás como paga").click();
await m.waitForTimeout(2000);
await m.goto(`${base}/casa/contas`, { waitUntil: "networkidle" });
ok(((await m.textContent("body")).replace(/\s+/g, " ")).includes("7 de 12 pagas"), "Pagar o Gás deixa 7 de 12 pagas");
await m.goto(`${base}/casa`, { waitUntil: "networkidle" });
ok(((await m.textContent("body")).replace(/\s+/g, " ")).includes("R$ 5.141,75"), "Saldo da Casa desconta o Gás (5.189,34 − 47,59)");
const d = await entrar("Dayane");
ok(new URL(d.url()).pathname === "/casa", "Dayane abre na Casa");
await d.goto(`${base}/clados/retirada`, { waitUntil: "networkidle" });
ok(new URL(d.url()).pathname !== "/clados/retirada", "Dayane não consegue abrir a tela de retirada");
const r = await d.request.post(`${base}/api/retiradas`, { data: { valor: 100, data: "2026-10-14" } });
ok(r.status() === 403, `API recusa retirada da Dayane (${r.status()})`);
await browser.close();
