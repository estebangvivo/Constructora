import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.MANUAL_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "manual", "screenshots");

/** @type {{ file: string, path: (id: string) => string }[]} */
const PAGES = [
  { file: "01-inicio.png", path: () => "/" },
  { file: "02-obras.png", path: () => "/projects" },
  { file: "03-obra-resumen.png", path: (id) => `/projects/${id}` },
  { file: "04-stakeholders.png", path: (id) => `/projects/${id}/stakeholders` },
  { file: "05-presupuesto.png", path: (id) => `/projects/${id}/budget` },
  { file: "06-certificaciones.png", path: (id) => `/projects/${id}/certifications` },
  { file: "07-ordenes-cambio.png", path: (id) => `/projects/${id}/change-orders` },
  { file: "08-cronograma.png", path: (id) => `/projects/${id}/schedule` },
  { file: "09-parte-diario.png", path: (id) => `/projects/${id}/daily-report` },
  { file: "10-punch-list.png", path: (id) => `/projects/${id}/punch-list` },
  { file: "11-documentos.png", path: (id) => `/projects/${id}/documents` },
  { file: "12-compras.png", path: (id) => `/projects/${id}/purchases` },
  { file: "13-inventario.png", path: (id) => `/projects/${id}/inventory` },
  { file: "14-tesoreria.png", path: () => "/treasury" },
  { file: "15-recibos.png", path: () => "/treasury/receipts" },
  { file: "16-ordenes-pago.png", path: () => "/treasury/payment-orders" },
  { file: "17-caja.png", path: () => "/treasury/cash" },
  { file: "18-clientes.png", path: () => "/clients" },
  { file: "19-proveedores.png", path: () => "/suppliers" },
  { file: "20-configuracion.png", path: () => "/settings" },
];

fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  await page.goto(`${BASE}/projects`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);

  const projectHref = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href^="/projects/"]')];
    const hit = links.find((a) =>
      /^\/projects\/[^/]+$/.test(a.getAttribute("href") || ""),
    );
    return hit?.getAttribute("href") ?? null;
  });

  if (!projectHref) {
    console.error("No hay obras. Creá una en /projects y reintentá.");
    await browser.close();
    process.exit(1);
  }

  const projectId = projectHref.replace("/projects/", "");
  console.log("projectId:", projectId);

  for (const item of PAGES) {
    const url = `${BASE}${item.path(projectId)}`;
    console.log("→", item.file, url);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    } catch {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    }
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUT, item.file),
      fullPage: true,
      type: "png",
    });
  }

  await browser.close();
  console.log("OK →", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
