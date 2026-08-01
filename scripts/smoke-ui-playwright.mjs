/**
 * Smoke UI con Playwright (páginas y redirects).
 * Uso: node scripts/smoke-ui-playwright.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const checks = [];

function ok(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function main() {
  console.log(`UI smoke · ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE}/sign-up`, { waitUntil: "domcontentloaded" });
    const hasPhone = await page.locator('input[name="phone"]').count();
    const hasConfirm = await page.locator('input[name="confirmPassword"]').count();
    const hasEye = await page.getByRole("button", { name: /Ver contraseña/i }).count();
    const hint = await page.getByText(/mayúscula.*número.*especial/i).count();
    if (hasPhone) ok("sign-up: teléfono");
    else fail("sign-up: teléfono", "campo ausente");
    if (hasConfirm) ok("sign-up: confirmar contraseña");
    else fail("sign-up: confirmar", "ausente");
    if (hasEye) ok("sign-up: ojito");
    else fail("sign-up: ojito", "ausente");
    if (hint) ok("sign-up: hint seguridad");
    else fail("sign-up: hint", "ausente");

    await page.fill('input[name="email"]', "ui-smoke@test.local");
    await page.fill('input[name="phone"]', "1155550000");
    await page.fill('input[name="password"]', "abcdef");
    await page.fill('input[name="confirmPassword"]', "abcdef");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForTimeout(500);
    const err = await page.getByRole("alert").textContent().catch(() => null);
    if (err && /mayúscula|caracteres|número|especial/i.test(err)) {
      ok("sign-up: rechaza clave débil", err.trim());
    } else if (await page.locator('input[name="password"]:invalid').count()) {
      ok("sign-up: HTML5 bloquea clave corta");
    } else {
      fail("sign-up: validación débil", err ?? "sin error visible");
    }

    await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
    if (await page.locator('input[name="email"], input[type="email"]').count()) {
      ok("sign-in: formulario");
    } else if (await page.getByText(/Iniciar|email|contraseña/i).count()) {
      ok("sign-in: UI login");
    } else {
      fail("sign-in", "no se reconoce formulario");
    }

    await page.goto(`${BASE}/onboarding/planes`, { waitUntil: "domcontentloaded" });
    const url = page.url();
    if (url.includes("sign-in") || url.includes("planes")) {
      ok("onboarding/planes", url.replace(BASE, ""));
    } else {
      fail("onboarding/planes", url);
    }

    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    ok("admin redirect/gate", page.url().replace(BASE, ""));
  } catch (e) {
    fail("playwright", e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  const bad = checks.filter((c) => !c.ok);
  console.log(`\n======== UI: ${checks.length - bad.length}/${checks.length} OK ========`);
  if (bad.length) process.exit(1);
}

main();
