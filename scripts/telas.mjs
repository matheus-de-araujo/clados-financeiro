// Abre cada tela num iPhone simulado e salva capturas em shots/ (node scripts/telas.mjs http://localhost:3100).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium, devices } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? "playwright");

const base = process.argv[2] ?? "http://localhost:3100";
const quem = process.argv[3] ?? "Matheus";
const so = process.argv[4]?.split(",");
mkdirSync("shots", { recursive: true });

const TELAS = {
  Matheus: [
    ["clados", "/clados"],
    ["clados-novo", "/clados#novo"],
    ["clientes", "/clados/clientes"],
    ["cliente", "/clados/clientes/2"],
    ["clados-extrato", "/clados/extrato"],
    ["clados-cartao", "/clados/cartao"],
    ["clados-contas", "/clados/contas"],
    ["recebi", "/clados/recebi"],
    ["trabalhei", "/clados/trabalhei"],
    ["paguei", "/clados/paguei"],
    ["retirada", "/clados/retirada"],
    ["novo-cliente", "/clados/clientes/novo"],
    ["casa", "/casa"],
    ["casa-nov", "/casa?m=2026-11"],
    ["casa-contas", "/casa/contas"],
    ["casa-cartoes", "/casa/cartoes"],
    ["conferir", "/casa/cartoes/1/conferir"],
    ["casa-extrato", "/casa/extrato"],
    ["gastei", "/casa/gastei"],
    ["fatura", "/casa/fatura"],
    ["entrou", "/casa/entrou"],
    ["reserva", "/casa/reserva"],
    ["fechamento", "/casa/fechamento?m=2026-09"],
    ["fechamento-out", "/casa/fechamento?m=2026-10"],
    ["dia-de-pagar", "/casa/dia-de-pagar"],
    ["nova-conta", "/casa/contas/nova"],
    ["pessoas", "/pessoas"],
  ],
  Dayane: [
    ["d-casa", "/casa"],
    ["d-clados", "/clados"],
  ],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(`${page.url()}: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !m.text().includes("caret-color") && erros.push(`${page.url()}: ${m.text().slice(0, 300)}`));
await page.goto(`${base}/entrar`);
await page.screenshot({ path: `shots/entrar.png` });
await page.getByRole("button", { name: quem, exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60_000 });
for (const [nome, url] of TELAS[quem]) {
  if (so && !so.includes(nome)) continue;
  const [path, hash] = url.split("#");
  const r = await page.goto(base + path, { waitUntil: "networkidle" });
  if (hash === "novo") await page.getByRole("button", { name: "Novo lançamento" }).click();
  if (hash !== "novo") await page.addStyleTag({ content: "nav.fixed{display:none!important}" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `shots/${nome}.png`, fullPage: hash !== "novo" });
  console.log(nome, r?.status());
}
console.log(erros.length ? "ERROS:\n" + erros.join("\n") : "sem erros no navegador");
await browser.close();
