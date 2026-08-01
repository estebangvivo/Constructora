/**
 * Smoke test del sistema: validaciones, DB, billing y rutas HTTP.
 * Uso: npx tsx scripts/smoke-system-test.ts
 */
import { PrismaClient } from "@prisma/client";

const BASE =
  process.env.SMOKE_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function section(title: string, fn: () => Promise<void>) {
  console.log(`\n== ${title} ==`);
  await fn();
}

async function main() {
  console.log(`Smoke test · base ${BASE}`);

  await section("Validación de contraseña", async () => {
    const { validatePasswordStrength } = await import(
      "../src/features/auth/lib/password"
    );
    const weak = [
      "corta",
      "sinmayus1!",
      "SinNumero!",
      "SinEspecial1",
      "Abcdefgh",
    ];
    for (const p of weak) {
      const r = validatePasswordStrength(p);
      if (r.ok) fail(`rechaza "${p}"`, "aceptó contraseña débil");
      else pass(`rechaza débil`, p);
    }
    const strong = validatePasswordStrength("Abcdef1!");
    if (strong.ok) pass("acepta fuerte", "Abcdef1!");
    else fail("acepta fuerte", strong.error);
  });

  await section("Validación de teléfono", async () => {
    const { isValidWhatsAppPhone, normalizeWhatsAppPhone } = await import(
      "../src/features/treasury/lib/share-message"
    );
    if (isValidWhatsAppPhone("11 5555-5555")) pass("AR móvil local");
    else fail("AR móvil local", "inválido");
    if (isValidWhatsAppPhone("+54 9 11 5555-5555")) pass("AR +54 9");
    else fail("AR +54 9", "inválido");
    if (!isValidWhatsAppPhone("123")) pass("rechaza corto");
    else fail("rechaza corto", "aceptó 123");
    const n = normalizeWhatsAppPhone("1155555555");
    if (n.startsWith("549")) pass("normaliza a 549…", n);
    else fail("normaliza", n);
  });

  const prisma = new PrismaClient();
  try {
    await section("Base de datos", async () => {
      await prisma.$queryRaw`SELECT 1`;
      pass("conexión PostgreSQL");

      const users = await prisma.user.count();
      pass("usuarios", String(users));

      const orgs = await prisma.organization.count();
      pass("empresas", String(orgs));

      const payments = await prisma.billingPayment.count();
      pass("pagos billing", String(payments));

      const settings = await prisma.$queryRawUnsafe<
        Array<{
          planPrices: unknown;
          mpSurchargePercent: unknown;
          transferAliasArs: string | null;
          transferCbuArs: string | null;
        }>
      >(
        `SELECT "planPrices", "mpSurchargePercent", "transferAliasArs", "transferCbuArs"
         FROM "platform_billing_settings" WHERE id = 'default' LIMIT 1`,
      );
      if (settings[0]) {
        pass(
          "billing settings",
          `recargo=${settings[0].mpSurchargePercent} alias=${settings[0].transferAliasArs ?? "—"}`,
        );
      } else {
        fail("billing settings", "sin fila default");
      }
    });

    await section("Billing efectivo", async () => {
      const {
        getEffectivePlanPrices,
        planCheckoutChargeEffective,
        planMercadoPagoChargeEffective,
      } = await import("../src/features/billing/lib/effective-plans");
      const {
        getMpSurchargePercent,
        getTransferBankDetailsEffective,
      } = await import(
        "../src/features/billing/lib/platform-billing-settings"
      );

      const prices = await getEffectivePlanPrices();
      if (prices.SOLO_MONTHLY.priceUsd > 0) {
        pass("precio SOLO_MONTHLY", `USD ${prices.SOLO_MONTHLY.priceUsd}`);
      } else fail("precio SOLO_MONTHLY", "0 o inválido");

      const surcharge = await getMpSurchargePercent();
      pass("recargo MP %", String(surcharge));

      const base = await planCheckoutChargeEffective("SOLO_MONTHLY");
      const mp = await planMercadoPagoChargeEffective("SOLO_MONTHLY");
      const expected =
        Math.round(base.amount * (1 + surcharge / 100) * 100) / 100;
      if (Math.abs(mp.amount - expected) < 0.001) {
        pass("MP = base + recargo", `${base.amount} → ${mp.amount}`);
      } else {
        fail("MP surcharge", `esperado ${expected}, got ${mp.amount}`);
      }

      const bank = await getTransferBankDetailsEffective();
      if (bank.cbuArs && bank.aliasArs) {
        pass("transferencia CBU/alias", `${bank.aliasArs}`);
      } else fail("transferencia", "faltan CBU/alias");
    });
  } finally {
    await prisma.$disconnect();
  }

  await section("HTTP rutas públicas", async () => {
    const paths = [
      "/sign-in",
      "/sign-up",
      "/onboarding/planes",
      "/billing",
      "/admin",
    ];
    for (const p of paths) {
      try {
        const res = await fetch(`${BASE}${p}`, {
          redirect: "manual",
          headers: { Accept: "text/html" },
        });
        const code = res.status;
        // 200 ok, 307/302/303 redirect a login/onboarding, 308
        if (code >= 200 && code < 400) {
          pass(`${p}`, `HTTP ${code}`);
        } else {
          fail(`${p}`, `HTTP ${code}`);
        }
      } catch (e) {
        fail(
          `${p}`,
          e instanceof Error ? e.message : "servidor no disponible",
        );
      }
    }
  });

  await section("Flujo registro (API lógica)", async () => {
    const { validatePasswordStrength } = await import(
      "../src/features/auth/lib/password"
    );
    const { isValidWhatsAppPhone } = await import(
      "../src/features/treasury/lib/share-message"
    );
    // Simula reglas del formulario sin crear usuario permanente ruidoso
    const email = `smoke_${Date.now()}@test.local`;
    const password = "SmokeTest1!";
    const phone = "1155551234";
    const s = validatePasswordStrength(password);
    const ph = isValidWhatsAppPhone(phone);
    if (s.ok && ph && email.includes("@")) {
      pass("payload registro válido");
    } else {
      fail("payload registro", `pwd=${s.ok} phone=${ph}`);
    }

    // Crear y borrar usuario de prueba en DB
    const p = new PrismaClient();
    try {
      const { hashPassword } = await import("../src/features/auth/lib/password");
      const created = await p.user.create({
        data: {
          authId: `local:${email}`,
          email,
          passwordHash: await hashPassword(password),
          phone,
          firstName: "Smoke",
          lastName: "Test",
        },
      });
      pass("crea usuario prueba", created.id);
      await p.user.delete({ where: { id: created.id } });
      pass("elimina usuario prueba");
    } catch (e) {
      fail(
        "CRUD usuario prueba",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      await p.$disconnect();
    }
  });

  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok);
  console.log(`\n======== RESULTADO: ${ok}/${results.length} OK ========`);
  if (bad.length) {
    console.log("Fallos:");
    for (const b of bad) console.log(`  - ${b.name}: ${b.detail}`);
    process.exit(1);
  }
  console.log("Todos los checks pasaron.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
