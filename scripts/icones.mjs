// Gera os ícones do app (rodar uma vez: node scripts/icones.mjs).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? "playwright");

const html = (s) => `<html><body style="margin:0"><div style="width:${s}px;height:${s}px;background:#0f3d32;display:flex;align-items:center;justify-content:center">
<svg width="${s * 0.56}" height="${s * 0.56}" viewBox="0 0 100 100"><rect x="14" y="16" width="72" height="16" rx="8" fill="#14b8a6"/><rect x="14" y="42" width="50" height="16" rx="8" fill="#f4f5f2"/><rect x="14" y="68" width="30" height="16" rx="8" fill="#f4f5f2" opacity=".55"/></svg></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [s, nome] of [[180, "apple-touch-icon.png"], [192, "icone-192.png"], [512, "icone-512.png"]]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(html(s));
  await page.screenshot({ path: `public/${nome}`, clip: { x: 0, y: 0, width: s, height: s } });
}
await browser.close();
console.log("ícones gerados");
