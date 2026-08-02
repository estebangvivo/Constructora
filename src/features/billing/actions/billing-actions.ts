"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthSession } from "@/lib/auth";
import { normalizeOrgSlug } from "@/features/auth/lib/org-slug";
import {
  BILLING_PLANS,
  isPaidBillingPlan,
  addBillingPeriod,
  type PaidBillingPlanId,
  type BillingPlanId,
  normalizeBillingPlanId,
} from "@/features/billing/lib/plans";
import {
  planCheckoutChargeEffective,
  planMercadoPagoChargeEffective,
  resolvePlanQuote,
} from "@/features/billing/lib/effective-plans";
import { setPaymentPromoMeta } from "@/features/billing/lib/billing-promo-org";
import { getBillingUsdArsRate } from "@/features/billing/lib/fx";
import { activateBillingPayment } from "@/features/billing/lib/activate";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import { ensureUserPhone } from "@/features/auth/lib/ensure-user-phone";

export type BillingActionResult =
  | { ok: true; paymentId?: string; organizationId?: string }
  | { ok: false; error: string };

function parsePaidPlan(raw: string): PaidBillingPlanId | null {
  const normalized = normalizeBillingPlanId(raw);
  if (normalized && isPaidBillingPlan(normalized)) return normalized;
  if (isPaidBillingPlan(raw)) return raw;
  return null;
}

/** Planes cobrables por MP/transferencia (incluye TRIAL a $1 ARS). */
function parseCheckoutPlan(raw: string): BillingPlanId | null {
  const normalized = normalizeBillingPlanId(raw);
  if (!normalized) return null;
  if (normalized === "TRIAL" || isPaidBillingPlan(normalized)) return normalized;
  return null;
}

/** Alta inmediata: prueba 30 días sin pago. */
export async function startTrialSignup(input: {
  companyName: string;
  companySlug?: string;
  phone?: string;
}): Promise<BillingActionResult> {
  try {
    const session = await requireAuthSession();
    if (session.organizationId) {
      return { ok: false, error: "Ya tenés una empresa asociada." };
    }

    const phoneOk = await ensureUserPhone(session.user.id, input.phone);
    if (!phoneOk.ok) return phoneOk;

    const companyName = input.companyName.trim();
    if (companyName.length < 2) {
      return { ok: false, error: "Indicá el nombre de la empresa." };
    }

    const existingTrial = await prisma.billingPayment.findFirst({
      where: {
        userId: session.user.id,
        plan: "TRIAL",
        status: "APPROVED",
      },
    });
    if (existingTrial) {
      return {
        ok: false,
        error: "Ya usaste la prueba gratuita. Elegí un plan de pago.",
      };
    }

    let slug = normalizeOrgSlug(input.companySlug || companyName);
    if (slug.length < 2) slug = `org-${session.user.id.slice(-8)}`;
    const taken = await prisma.organization.findUnique({ where: { slug } });
    if (taken) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const now = new Date();
    const periodEnd = addBillingPeriod(now, "TRIAL");

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: companyName,
          slug,
          currency: "ARS",
          enabledCurrencies: ["ARS", "USD"],
          themeId: "obra",
          country: "AR",
          billingStatus: "ACTIVE",
          billingPlan: "TRIAL",
          paidUntil: periodEnd,
          members: {
            create: {
              userId: session.user.id,
              role: "ADMIN",
              allowedModules: [],
            },
          },
        },
      });

      await tx.billingPayment.create({
        data: {
          userId: session.user.id,
          organizationId: created.id,
          companyName,
          companySlug: slug,
          plan: "TRIAL",
          method: "TRANSFER",
          currency: "USD",
          amount: 0,
          status: "APPROVED",
          periodStart: now,
          periodEnd,
          notes: "Prueba gratuita 30 días",
        },
      });

      return created;
    });

    const { signLocalSession, setLocalSessionCookie } = await import(
      "@/features/auth/lib/session"
    );
    const token = await signLocalSession({
      userId: session.user.id,
      organizationId: org.id,
    });
    await setLocalSessionCookie(token);

    revalidatePath("/", "layout");
    revalidatePath("/onboarding/planes");
    return { ok: true, organizationId: org.id };
  } catch (error) {
    console.error("startTrialSignup", error);
    const message =
      error instanceof Error && error.message.includes("BillingPlan")
        ? "El esquema de planes no está actualizado. Reiniciá el servidor tras regenerar Prisma (npx prisma generate)."
        : error instanceof Error && /Unique|P2002|slug/i.test(error.message)
          ? "Ese identificador de empresa ya está en uso. Probá otro."
          : "No se pudo iniciar la prueba.";
    return { ok: false, error: message };
  }
}

async function resolveTransferAmount(
  plan: BillingPlanId,
  currency: "USD" | "ARS",
  organizationId?: string | null,
): Promise<
  | {
      ok: true;
      amount: number;
      currency: "USD" | "ARS";
      fxRateUsed: number | null;
      discountPercent: number | null;
      grantPromoMonths: number | null;
    }
  | { ok: false; error: string }
> {
  const quote = await resolvePlanQuote({ plan, organizationId });
  const charge = await planCheckoutChargeEffective(plan, organizationId);
  // Planes con precio fijo en ARS (ej. TRIAL $1): transferencia en ARS sin FX.
  if (charge.currency === "ARS") {
    return {
      ok: true,
      amount: charge.amount,
      currency: "ARS",
      fxRateUsed: null,
      discountPercent: quote.discountPercent,
      grantPromoMonths: quote.grantPromoMonths,
    };
  }
  if (currency === "USD") {
    return {
      ok: true,
      amount: charge.amount,
      currency: "USD",
      fxRateUsed: null,
      discountPercent: quote.discountPercent,
      grantPromoMonths: quote.grantPromoMonths,
    };
  }
  const rate = await getBillingUsdArsRate();
  if (!rate) {
    return {
      ok: false,
      error:
        "No hay tipo de cambio USD→ARS disponible. Pagá en USD o reintentá más tarde.",
    };
  }
  return {
    ok: true,
    amount: Math.round(charge.amount * rate * 100) / 100,
    currency: "ARS",
    fxRateUsed: rate,
    discountPercent: quote.discountPercent,
    grantPromoMonths: quote.grantPromoMonths,
  };
}

/** Alta: crea pago PENDING por transferencia y deja pendiente de revisión. */
export async function submitTransferSignup(input: {
  plan: string;
  currency: "USD" | "ARS";
  companyName: string;
  companySlug?: string;
  proofDataUrl: string;
  notes?: string;
  phone?: string;
}): Promise<BillingActionResult> {
  try {
    const session = await requireAuthSession();
    const plan = parseCheckoutPlan(input.plan);
    if (!plan) return { ok: false, error: "Plan inválido." };

    const phoneOk = await ensureUserPhone(session.user.id, input.phone);
    if (!phoneOk.ok) return phoneOk;

    if (plan === "TRIAL") {
      const existingTrial = await prisma.billingPayment.findFirst({
        where: {
          userId: session.user.id,
          plan: "TRIAL",
          status: "APPROVED",
        },
      });
      if (existingTrial) {
        return {
          ok: false,
          error: "Ya usaste la prueba. Elegí un plan de pago.",
        };
      }
    }

    const companyName = input.companyName.trim();
    if (companyName.length < 2) {
      return { ok: false, error: "Indicá el nombre de la empresa." };
    }

    if (!input.proofDataUrl.startsWith("data:")) {
      return { ok: false, error: "Subí el comprobante de transferencia." };
    }
    if (input.proofDataUrl.length > 3_500_000) {
      return { ok: false, error: "El comprobante no puede superar ~2.5 MB." };
    }

    const resolved = await resolveTransferAmount(plan, input.currency, null);
    if (!resolved.ok) return resolved;

    const payment = await prisma.billingPayment.create({
      data: {
        userId: session.user.id,
        organizationId: null,
        companyName,
        companySlug: normalizeOrgSlug(input.companySlug || companyName),
        plan,
        method: "TRANSFER",
        currency: resolved.currency,
        amount: resolved.amount,
        fxRateUsed: resolved.fxRateUsed,
        status: "PENDING",
        transferProofUrl: input.proofDataUrl,
        notes: input.notes?.trim() || null,
      },
    });
    await setPaymentPromoMeta({
      paymentId: payment.id,
      discountPercent: resolved.discountPercent,
      promoMonths: resolved.grantPromoMonths,
    });

    revalidatePath("/onboarding/pago");
    revalidatePath("/admin");
    return { ok: true, paymentId: payment.id };
  } catch (error) {
    console.error("submitTransferSignup", error);
    return { ok: false, error: "No se pudo registrar el pago." };
  }
}

/** Renovación por transferencia de la empresa actual. */
export async function submitTransferRenewal(input: {
  plan: string;
  currency: "USD" | "ARS";
  proofDataUrl: string;
  notes?: string;
  phone?: string;
}): Promise<BillingActionResult> {
  try {
    const session = await requireAuthSession();
    if (!session.organizationId) {
      return { ok: false, error: "No tenés una empresa activa." };
    }
    const phoneOk = await ensureUserPhone(session.user.id, input.phone);
    if (!phoneOk.ok) return phoneOk;
    const plan = parseCheckoutPlan(input.plan);
    if (!plan) return { ok: false, error: "Plan inválido." };

    if (!input.proofDataUrl.startsWith("data:")) {
      return { ok: false, error: "Subí el comprobante de transferencia." };
    }

    const resolved = await resolveTransferAmount(
      plan,
      input.currency,
      session.organizationId,
    );
    if (!resolved.ok) return resolved;

    const payment = await prisma.billingPayment.create({
      data: {
        userId: session.user.id,
        organizationId: session.organizationId,
        plan,
        method: "TRANSFER",
        currency: resolved.currency,
        amount: resolved.amount,
        fxRateUsed: resolved.fxRateUsed,
        status: "PENDING",
        transferProofUrl: input.proofDataUrl,
        notes: input.notes?.trim() || null,
      },
    });
    await setPaymentPromoMeta({
      paymentId: payment.id,
      discountPercent: resolved.discountPercent,
      promoMonths: resolved.grantPromoMonths,
    });

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { billingStatus: "PENDING_PAYMENT" },
    });

    revalidatePath("/billing");
    revalidatePath("/admin");
    return { ok: true, paymentId: payment.id };
  } catch (error) {
    console.error("submitTransferRenewal", error);
    return { ok: false, error: "No se pudo registrar la renovación." };
  }
}

/** Crea registro PENDING para checkout Mercado Pago (alta). */
export async function createMercadoPagoSignupIntent(input: {
  plan: string;
  companyName: string;
  companySlug?: string;
  phone?: string;
}): Promise<BillingActionResult & { preferenceId?: string; initPoint?: string }> {
  try {
    const session = await requireAuthSession();
    const plan = parseCheckoutPlan(input.plan);
    if (!plan) return { ok: false, error: "Plan inválido." };

    const phoneOk = await ensureUserPhone(session.user.id, input.phone);
    if (!phoneOk.ok) return phoneOk;

    if (plan === "TRIAL") {
      const existingTrial = await prisma.billingPayment.findFirst({
        where: {
          userId: session.user.id,
          plan: "TRIAL",
          status: "APPROVED",
        },
      });
      if (existingTrial) {
        return {
          ok: false,
          error: "Ya usaste la prueba. Elegí un plan de pago.",
        };
      }
    }

    const companyName = input.companyName.trim();
    if (companyName.length < 2) {
      return { ok: false, error: "Indicá el nombre de la empresa." };
    }

    const { createMercadoPagoCheckout } = await import(
      "@/features/billing/lib/mercadopago"
    );

    const quote = await resolvePlanQuote({ plan, organizationId: null });
    const charge = await planMercadoPagoChargeEffective(plan, null);
    const payment = await prisma.billingPayment.create({
      data: {
        userId: session.user.id,
        companyName,
        companySlug: normalizeOrgSlug(input.companySlug || companyName),
        plan,
        method: "MERCADOPAGO",
        currency: charge.currency,
        amount: charge.amount,
        status: "PENDING",
        notes: [
          plan === "TRIAL" ? "Prueba 30 días (Mercado Pago)" : null,
          charge.surchargePercent > 0
            ? `Incluye recargo MP ${charge.surchargePercent}% (base ${charge.currency} ${charge.baseAmount})`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });
    await setPaymentPromoMeta({
      paymentId: payment.id,
      discountPercent: quote.discountPercent,
      promoMonths: quote.grantPromoMonths,
    });

    const checkout = await createMercadoPagoCheckout({
      paymentId: payment.id,
      plan,
      title: `${BILLING_PLANS[plan].label} — ${companyName}`,
      payerEmail: session.user.email,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/onboarding/planes?mp=success`,
      failureUrl: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/onboarding/pago?plan=${plan}&mp=failure`,
    });

    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        mpPreferenceId: checkout.preferenceId,
        mpPreapprovalId: checkout.preapprovalId ?? null,
      },
    });

    return {
      ok: true,
      paymentId: payment.id,
      preferenceId: checkout.preferenceId,
      initPoint: checkout.initPoint,
    };
  } catch (error) {
    console.error("createMercadoPagoSignupIntent", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el pago con Mercado Pago.",
    };
  }
}

export async function createMercadoPagoRenewalIntent(input: {
  plan: string;
  phone?: string;
}): Promise<BillingActionResult & { initPoint?: string }> {
  try {
    const session = await requireAuthSession();
    if (!session.organizationId) {
      return { ok: false, error: "No tenés una empresa activa." };
    }
    const phoneOk = await ensureUserPhone(session.user.id, input.phone);
    if (!phoneOk.ok) return phoneOk;
    const plan = parseCheckoutPlan(input.plan);
    if (!plan) return { ok: false, error: "Plan inválido." };

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });

    const { createMercadoPagoCheckout } = await import(
      "@/features/billing/lib/mercadopago"
    );

    const quote = await resolvePlanQuote({
      plan,
      organizationId: session.organizationId,
    });
    const charge = await planMercadoPagoChargeEffective(
      plan,
      session.organizationId,
    );
    const payment = await prisma.billingPayment.create({
      data: {
        userId: session.user.id,
        organizationId: session.organizationId,
        plan,
        method: "MERCADOPAGO",
        currency: charge.currency,
        amount: charge.amount,
        status: "PENDING",
        notes:
          charge.surchargePercent > 0
            ? `Incluye recargo MP ${charge.surchargePercent}% (base ${charge.currency} ${charge.baseAmount})`
            : null,
      },
    });
    await setPaymentPromoMeta({
      paymentId: payment.id,
      discountPercent: quote.discountPercent,
      promoMonths: quote.grantPromoMonths,
    });

    const checkout = await createMercadoPagoCheckout({
      paymentId: payment.id,
      plan,
      title: `Renovación ${BILLING_PLANS[plan].label} — ${org?.name ?? "Empresa"}`,
      payerEmail: session.user.email,
    });

    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        mpPreferenceId: checkout.preferenceId,
        mpPreapprovalId: checkout.preapprovalId ?? null,
      },
    });

    return {
      ok: true,
      paymentId: payment.id,
      initPoint: checkout.initPoint,
    };
  } catch (error) {
    console.error("createMercadoPagoRenewalIntent", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el pago con Mercado Pago.",
    };
  }
}

/**
 * Al volver de Mercado Pago (back_url), confirma el pago si el webhook no llegó.
 * MP suele enviar payment_id / collection_id / external_reference / status.
 */
export async function syncMercadoPagoCheckoutReturn(input: {
  paymentId?: string | null;
  collectionId?: string | null;
  externalReference?: string | null;
  status?: string | null;
  preferenceId?: string | null;
}): Promise<BillingActionResult & { activated?: boolean }> {
  try {
    const session = await requireAuthSession();
    const status = (input.status ?? "").toLowerCase();
    const mpId = (input.paymentId || input.collectionId || "").trim();
    const externalRef = (input.externalReference ?? "").trim();
    const preferenceId = (input.preferenceId ?? "").trim();

    if (status && status !== "approved") {
      return { ok: true, activated: false };
    }

    let billingPaymentId: string | null = externalRef || null;

    if (mpId) {
      try {
        const { fetchMercadoPagoPayment } = await import(
          "@/features/billing/lib/mercadopago"
        );
        const mpPayment = await fetchMercadoPagoPayment(mpId);
        if (mpPayment.status !== "approved") {
          return { ok: true, activated: false };
        }
        if (mpPayment.external_reference) {
          billingPaymentId = mpPayment.external_reference;
        }
      } catch (error) {
        console.warn("syncMercadoPagoCheckoutReturn fetch", error);
      }
    }

    if (!billingPaymentId && preferenceId) {
      const byPref = await prisma.billingPayment.findFirst({
        where: {
          userId: session.user.id,
          method: "MERCADOPAGO",
          status: "PENDING",
          OR: [
            { mpPreferenceId: preferenceId },
            { mpPreapprovalId: preferenceId },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      billingPaymentId = byPref?.id ?? null;
    }

    if (!billingPaymentId) {
      const latest = await prisma.billingPayment.findFirst({
        where: {
          userId: session.user.id,
          method: "MERCADOPAGO",
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });
      billingPaymentId = latest?.id ?? null;
    }

    if (!billingPaymentId) {
      return { ok: true, activated: false };
    }

    const existing = await prisma.billingPayment.findUnique({
      where: { id: billingPaymentId },
    });
    if (!existing || existing.userId !== session.user.id) {
      return { ok: false, error: "Pago no encontrado." };
    }
    if (existing.status === "APPROVED") {
      if (existing.organizationId) {
        const { signLocalSession, setLocalSessionCookie } = await import(
          "@/features/auth/lib/session"
        );
        const token = await signLocalSession({
          userId: session.user.id,
          organizationId: existing.organizationId,
        });
        await setLocalSessionCookie(token);
      }
      return { ok: true, activated: true, organizationId: existing.organizationId ?? undefined };
    }

    const updated = await activateBillingPayment(billingPaymentId, {
      mpPaymentId: mpId || undefined,
    });

    if (updated.organizationId) {
      const { signLocalSession, setLocalSessionCookie } = await import(
        "@/features/auth/lib/session"
      );
      const token = await signLocalSession({
        userId: session.user.id,
        organizationId: updated.organizationId,
      });
      await setLocalSessionCookie(token);
    }

    revalidatePath("/", "layout");
    revalidatePath("/billing");
    revalidatePath("/admin");
    revalidatePath("/onboarding/planes");
    return {
      ok: true,
      activated: true,
      paymentId: updated.id,
      organizationId: updated.organizationId ?? undefined,
    };
  } catch (error) {
    console.error("syncMercadoPagoCheckoutReturn", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo confirmar el pago de Mercado Pago.",
    };
  }
}

export async function getMyBillingContext() {
  const session = await requireAuthSession();
  if (!session.organizationId) {
    return { organization: null, payments: [] as const };
  }

  const [organization, payments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        billingStatus: true,
        billingPlan: true,
        paidUntil: true,
      },
    }),
    prisma.billingPayment.findMany({
      where: {
        OR: [
          { organizationId: session.organizationId },
          { userId: session.user.id, organizationId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    organization: organization
      ? {
          ...organization,
          hasAccess: organizationHasAppAccess(organization),
          paidUntil: organization.paidUntil?.toISOString() ?? null,
        }
      : null,
    payments: payments.map((p) => ({
      id: p.id,
      plan: p.plan,
      method: p.method,
      currency: p.currency,
      amount: Number(p.amount),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      periodEnd: p.periodEnd?.toISOString() ?? null,
    })),
  };
}

// re-export for webhook convenience typing
export { activateBillingPayment };
