import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REC = path.join(__dirname, "app-recording-rich");
fs.mkdirSync(REC, { recursive: true });
for (const f of fs.readdirSync(REC)) {
  try {
    fs.unlinkSync(path.join(REC, f));
  } catch {}
}

const BASE = "http://localhost:3000";
const EMAIL = "admin@demo-constructora.local";
const PASS = "admin123";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function safe(fn, label) {
  try {
    await fn();
  } catch (e) {
    console.warn("skip", label, e.message?.slice(0, 120));
  }
}

async function move(page, x, y, steps = 10) {
  await page.mouse.move(x, y, { steps }).catch(() => {});
  await wait(70);
}

async function clickFirst(page, selectors, after = 550) {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      const box = await loc.boundingBox();
      if (box) await move(page, box.x + box.width / 2, box.y + box.height / 2, 12);
      await loc.click({ timeout: 3500 });
      await wait(after);
      return true;
    } catch {
      /* navigation races */
    }
  }
  return false;
}

async function sweep(page) {
  await move(page, 420, 220, 8);
  await page.mouse.wheel(0, 360).catch(() => {});
  await wait(240);
  await move(page, 1000, 450, 10);
  await page.mouse.wheel(0, 260).catch(() => {});
  await wait(220);
  await page.mouse.wheel(0, -400).catch(() => {});
  await wait(180);
}

async function visit(page, route) {
  await safe(async () => {
    await page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await wait(420);
    await sweep(page);
    console.log("ok", route);
  }, route);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: "es-AR",
  recordVideo: { dir: REC, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
await wait(400);
await page.locator('input[name="email"]').fill(EMAIL);
await wait(150);
await page.locator('input[name="password"]').fill(PASS);
await wait(150);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 45000 }),
  page.locator('form button[type="submit"]').click(),
]);
await wait(700);

if (page.url().includes("select-organization")) {
  await clickFirst(page, [
    'button:has-text("Demo")',
    'button:has-text("Constructora")',
    "main button",
    "button",
  ], 900);
  await wait(800);
}

await visit(page, "/");
await visit(page, "/projects");

let projectId = null;
await safe(async () => {
  await clickFirst(page, ['a[href*="/projects/"]'], 1000);
  const m = page.url().match(/\/projects\/([^/?#]+)/);
  projectId = m?.[1] ?? null;
}, "open-project");

if (projectId) {
  const base = `/projects/${projectId}`;
  for (const route of [
    base,
    `${base}/budget`,
    `${base}/certifications`,
    `${base}/schedule`,
    `${base}/daily-report`,
    `${base}/punch-list`,
    `${base}/documents`,
    `${base}/purchases`,
    `${base}/inventory`,
    `${base}/stakeholders`,
    `${base}/change-orders`,
    `${base}/contractors`,
  ]) {
    await visit(page, route);
  }
}

await visit(page, "/treasury");
await visit(page, "/treasury/receipts");
await safe(async () => {
  await clickFirst(page, ['a[href*="/treasury/receipts/"]'], 900);
  await sweep(page);
}, "open-receipt");
await visit(page, "/treasury/payment-orders");
await safe(async () => {
  await clickFirst(page, ['a[href*="/treasury/payment-orders/"]'], 900);
  await sweep(page);
}, "open-op");
await visit(page, "/treasury/cash");
await visit(page, "/treasury/banks");
await visit(page, "/treasury/checks");
await visit(page, "/treasury/accounts");
await visit(page, "/clients");
await visit(page, "/suppliers");
await visit(page, "/settings");
await visit(page, "/settings/users");
await visit(page, "/manual");
await visit(page, "/turnero");

await context.close();
await browser.close();
console.log("videos", fs.readdirSync(REC).filter((f) => f.endsWith(".webm")));
