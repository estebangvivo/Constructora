/**
 * Smoke test end-to-end del ERP Constructora (HTTP).
 * Uso: npx tsx scripts/smoke-test.mjs
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@demo-constructora.local";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "admin123";

const results = [];
let cookie = "";

function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function pickCookie(res) {
  const fromGetter =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  const single = res.headers.get("set-cookie");
  const list = fromGetter.length ? fromGetter : single ? [single] : [];
  for (const line of list) {
    const m = String(line).match(/constructora_session=[^;]+/);
    if (m) {
      cookie = m[0];
      return;
    }
  }
}

async function req(path, init = {}) {
  const headers = {
    ...(init.headers ?? {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  pickCookie(res);
  return res;
}

async function expectStatus(name, path, statuses, init) {
  try {
    const res = await req(path, init);
    if (statuses.includes(res.status)) {
      ok(name, `${res.status} ${path}`);
      return res;
    }
    const body = await res.text().catch(() => "");
    fail(
      name,
      `esperado ${statuses.join("|")}, got ${res.status} ${path} ${body.slice(0, 120)}`,
    );
    return res;
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function expectJson(name, path, check) {
  const res = await expectStatus(name + " (status)", path, [200]);
  if (!res || res.status !== 200) return null;
  try {
    const data = await res.json();
    const msg = check(data);
    if (msg) fail(name, msg);
    else ok(name);
    return data;
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function main() {
  console.log(`\nSmoke test → ${BASE}\n`);

  // Health
  console.log("— Infra —");
  await expectStatus("Health", "/api/health", [200]);

  // Login JSON (más fiable para tests que el form + redirect)
  console.log("\n— Auth —");
  const loginRes = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  pickCookie(loginRes);
  if (loginRes.status === 200 && cookie) {
    ok("Login local", "JSON + cookie");
  } else {
    const errBody = await loginRes.text().catch(() => "");
    fail(
      "Login local",
      `status=${loginRes.status} cookie=${Boolean(cookie)} ${errBody.slice(0, 80)}`,
    );
  }

  // Páginas dashboard (autenticadas)
  console.log("\n— Dashboard (páginas) —");
  const pages = [
    "/",
    "/projects",
    "/clients",
    "/suppliers",
    "/treasury",
    "/treasury/receipts",
    "/treasury/payment-orders",
    "/treasury/cash",
    "/settings",
    "/settings/users",
    "/manual",
    "/turnero",
    "/turnero/totem",
    "/turnero/operador",
  ];
  for (const p of pages) {
    await expectStatus(`GET ${p}`, p, [200]);
  }

  // Pantalla pública sin cookie
  console.log("\n— Turnero público —");
  const saved = cookie;
  cookie = "";
  await expectStatus("Pantalla pública sin login", "/turnero/pantalla", [200]);
  await expectStatus("API pantalla pública", "/api/turnero/pantalla", [200]);
  // Tótem sin login debe redirigir a sign-in
  const totemAnon = await req("/turnero/totem");
  if ([302, 303, 307].includes(totemAnon.status)) {
    const loc = totemAnon.headers.get("location") ?? "";
    if (loc.includes("sign-in")) ok("Tótem exige login", loc);
    else fail("Tótem exige login", `redirect a ${loc}`);
  } else if (totemAnon.status === 200) {
    fail("Tótem exige login", "devolvió 200 sin sesión");
  } else {
    fail("Tótem exige login", `status ${totemAnon.status}`);
  }
  cookie = saved;

  // Prisma: org + proyecto demo
  console.log("\n— Datos / APIs turnero —");
  const prisma = new PrismaClient();
  let projectId = null;
  let orgId = null;
  try {
    const org = await prisma.organization.findFirst({
      where: { slug: "demo-constructora" },
    });
    orgId = org?.id ?? null;
    const project = await prisma.project.findFirst({
      where: orgId ? { organizationId: orgId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    projectId = project?.id ?? null;
    if (org) ok("Org demo existe", org.name);
    else fail("Org demo existe");
    if (project) ok("Hay al menos una obra", `${project.code} ${project.name}`);
    else fail("Hay al menos una obra");
  } finally {
    await prisma.$disconnect();
  }

  // CRUD mínimo puestos
  const createPuesto = await req("/api/turnero/puestos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: `Smoke Box ${Date.now().toString(36)}`,
      categoria: "CAJA",
    }),
  });
  let puestoId = null;
  if (createPuesto.status === 201) {
    const p = await createPuesto.json();
    puestoId = p.id;
    ok("Crear puesto turnero", p.nombre);
  } else {
    const t = await createPuesto.text();
    fail("Crear puesto turnero", `${createPuesto.status} ${t.slice(0, 100)}`);
  }

  await expectJson("Listar puestos", "/api/turnero/puestos", (data) =>
    Array.isArray(data) ? null : "no es array",
  );

  // Cliente + turno
  const dni = `9${String(Date.now()).slice(-7)}`;
  const clienteRes = await req("/api/turnero/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dni, nombre: "Cliente Smoke Test" }),
  });
  let clienteId = null;
  if ([200, 201].includes(clienteRes.status)) {
    const c = await clienteRes.json();
    clienteId = c.cliente?.id ?? c.id;
    ok("Registrar cliente turnero", dni);
  } else {
    fail("Registrar cliente turnero", String(clienteRes.status));
  }

  if (clienteId) {
    const turnoRes = await req("/api/turnero/turnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoria: "CAJA", clienteId }),
    });
    if (turnoRes.status === 201 || turnoRes.status === 200) {
      const t = await turnoRes.json();
      ok("Emitir turno", t.codigo ?? JSON.stringify(t).slice(0, 40));
    } else {
      fail("Emitir turno", `${turnoRes.status} ${(await turnoRes.text()).slice(0, 100)}`);
    }
  }

  await expectJson("Turnos del día", "/api/turnero/turnos?scope=hoy", (data) =>
    Array.isArray(data) ? null : "no es array",
  );

  // Cleanup puesto smoke
  if (puestoId) {
    const del = await req(`/api/turnero/puestos/${puestoId}`, {
      method: "DELETE",
    });
    if ([200, 204].includes(del.status)) ok("Eliminar puesto smoke");
    else {
      // soft delete / PATCH
      const soft = await req(`/api/turnero/puestos/${puestoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: false }),
      });
      if ([200, 204].includes(soft.status)) ok("Desactivar puesto smoke");
      else fail("Cleanup puesto", `${del.status}/${soft.status}`);
    }
  }

  // Páginas de obra si hay projectId
  if (projectId) {
    console.log("\n— Módulos de obra —");
    const sub = [
      "",
      "/budget",
      "/daily-report",
      "/punch-list",
      "/certifications",
      "/change-orders",
      "/schedule",
      "/documents",
      "/purchases",
      "/inventory",
      "/contractors",
      "/stakeholders",
    ];
    for (const s of sub) {
      await expectStatus(
        `Obra ${s || "/"}`,
        `/projects/${projectId}${s}`,
        [200],
      );
    }
  }

  // Sign-in page pública
  console.log("\n— Auth pages —");
  cookie = "";
  await expectStatus("Sign-in público", "/sign-in", [200]);

  // Resumen
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n======== RESUMEN ========`);
  console.log(`OK: ${passed}  FAIL: ${failed}  TOTAL: ${results.length}`);
  if (failed) {
    console.log("\nFallos:");
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\nTodo el smoke test pasó.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
