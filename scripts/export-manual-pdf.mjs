import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.MANUAL_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "manual-usuario.pdf");

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

await page.goto(`${BASE}/manual`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  await Promise.all(
    [...document.images].map((img) =>
      img.complete
        ? null
        : new Promise((resolve) => {
            img.onload = img.onerror = () => resolve(null);
          }),
    ),
  );
});

await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
});

await browser.close();
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`OK ${OUT} (${kb} KB)`);
