// Mede quanto tempo cada toque leva para dar resposta na tela, num iPhone simulado com rede de celular.
// Uso: node scripts/velocidade.mjs http://localhost:3100 [latência em ms, padrão 150]
// "resposta" = a primeira mudança visível (aba acesa, esqueleto ou tela nova); "pronta" = a tela nova com os dados.
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? "playwright");
const base = process.argv[2] ?? "http://localhost:3100";
const latencia = Number(process.argv[3] ?? 150);
// Quanto a pessoa olha a tela antes de tocar (dá tempo de o app buscar as abas de antemão). 0 = toca na hora.
const olhar = Number(process.argv[4] ?? 600);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable");
// Rede de celular razoável: cada ida e volta custa `latencia` ms.
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: latencia, downloadThroughput: (6 * 1024 * 1024) / 8, uploadThroughput: (2 * 1024 * 1024) / 8 });

await p.goto(`${base}/entrar`);
await p.getByRole("button", { name: "Matheus", exact: true }).click();
await p.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60_000 });
await p.waitForLoadState("networkidle");

/** Toca no elemento e mede dentro da página, sem o atraso do Playwright. */
async function tocar(rotulo, seletor, pronto) {
  if (olhar) {
    await p.waitForLoadState("networkidle").catch(() => {});
    await p.waitForTimeout(olhar);
  } else await p.waitForTimeout(50);
  const r = await p.evaluate(
    ({ seletor, pronto }) =>
      new Promise((resolve) => {
        const el = document.querySelector(seletor);
        if (!el) return resolve({ erro: "não achei " + seletor });
        const url0 = location.href;
        const main0 = document.querySelector("main")?.innerHTML;
        const t0 = performance.now();
        let resposta = null;
        const passo = () => {
          const t = performance.now() - t0;
          const aceso = el.getAttribute("aria-current") === "page" || el.classList.contains("on");
          const esq = !!document.querySelector(".esqueleto");
          const mudou = location.href !== url0 || document.querySelector("main")?.innerHTML !== main0;
          if (resposta === null && (aceso || esq || mudou)) resposta = t;
          if (new Function("return " + pronto)()) return resolve({ resposta, pronta: t });
          if (t > 20000) return resolve({ resposta, pronta: null });
          requestAnimationFrame(passo);
        };
        el.click();
        requestAnimationFrame(passo);
      }),
    { seletor, pronto },
  );
  const f = (n) => (n == null ? "—" : `${Math.round(n)} ms`.padStart(8));
  console.log(`${rotulo.padEnd(34)} resposta ${f(r.resposta)}   pronta ${f(r.pronta)}${r.erro ? "  " + r.erro : ""}`);
  return r;
}

const semEsqueleto = `!document.querySelector(".esqueleto")`;
const em = (path, texto) => `location.pathname === "${path}" && ${semEsqueleto} && document.querySelector("main")?.textContent.includes("${texto}")`;

// Tempo que o servidor leva para montar cada tela (sem a rede do celular).
const tempos = [];
for (const url of ["/clados", "/clados/clientes", "/clados/extrato", "/casa", "/casa/contas", "/casa/cartoes"]) {
  const t = performance.now();
  await p.request.get(base + url);
  tempos.push(`${url} ${Math.round(performance.now() - t)} ms`);
}
console.log("Servidor:", tempos.join(" · "));
console.log(`Latência simulada: ${latencia} ms por ida e volta · olha a tela ${olhar} ms antes de tocar\n`);
const res = [];
res.push(await tocar("Clados › Clientes", 'nav a[href="/clados/clientes"]', em("/clados/clientes", "Alfa")));
res.push(await tocar("Clados › Extrato", 'nav a[href="/clados/extrato"]', em("/clados/extrato", "Extrato")));
res.push(await tocar("Clados › Cartão", 'nav a[href="/clados/cartao"]', em("/clados/cartao", "Fatura")));
res.push(await tocar("Clados › Início", 'nav a[href="/clados"]', em("/clados", "Pode retirar")));
res.push(await tocar("Clados › Clientes (de novo)", 'nav a[href="/clados/clientes"]', em("/clados/clientes", "Alfa")));
res.push(await tocar("Clados › Início (de novo)", 'nav a[href="/clados"]', em("/clados", "Pode retirar")));
res.push(await tocar("Trocar para a Casa", 'header a[href="/casa"]', em("/casa", "Saldo na conta da Casa")));
res.push(await tocar("Casa › Contas", 'nav a[href="/casa/contas"]', em("/casa/contas", "pagas")));
res.push(await tocar("Marcar o Gás como paga", 'button[aria-label="Marcar Gás como paga"]', `document.querySelector('button[aria-label="Desmarcar Gás"]')?.classList.contains("on")`));
res.push(await tocar("Casa › Cartões", 'nav a[href="/casa/cartoes"]', em("/casa/cartoes", "Cartões")));
res.push(await tocar("Casa › Início", 'nav a[href="/casa"]', em("/casa", "Saldo na conta da Casa")));

const ok = res.filter((r) => r.resposta != null);
const media = (k) => Math.round(ok.reduce((a, r) => a + (r[k] ?? 0), 0) / ok.length);
console.log(`\nMédia: resposta ${media("resposta")} ms · pronta ${media("pronta")} ms · pior pronta ${Math.round(Math.max(...ok.map((r) => r.pronta ?? 0)))} ms`);
await browser.close();
