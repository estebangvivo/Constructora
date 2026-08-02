import type { BillingPlan, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeOrgSlug } from "@/features/auth/lib/org-slug";
import {
  addBillingPeriod,
  normalizeBillingPlanId,
  planIsMonthlyCycle,
  type BillingPlanId,
} from "@/features/billing/lib/plans";
import {
  getPaymentPromoMeta,
  lockOrgBillingPromo,
} from "@/features/billing/lib/billing-promo-org";

type Tx = Prisma.TransactionClient;

async function applyPromoLockFromPayment(
  paymentId: string,
  organizationId: string,
  plan: BillingPlanId,
) {
  if (!planIsMonthlyCycle(plan)) return;
  const meta = await getPaymentPromoMeta(paymentId);
  if (
    meta.discountPercent == null ||
    meta.promoMonths == null ||
    meta.promoMonths < 1
  ) {
    return;
  }
  await lockOrgBillingPromo({
    organizationId,
    percent: meta.discountPercent,
    months: meta.promoMonths,
  });
}

export async function activateBillingPayment(
  paymentId: string,
  opts?: { approvedById?: string; mpPaymentId?: string },
) {
  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.billingPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new Error("Pago no encontrado");
    if (payment.status === "APPROVED") return { payment, freshlyApproved: false };
    if (payment.status === "REJECTED") {
      throw new Error("El pago fue rechazado");
    }

    const plan =
      normalizeBillingPlanId(payment.plan) ??
      ("TEAM_MONTHLY" as BillingPlanId);
    const now = new Date();
    let organizationId = payment.organizationId;

    if (!organizationId) {
      const name = (payment.companyName ?? "Mi Constructora").trim();
      let slug = normalizeOrgSlug(payment.companySlug || name);
      if (slug.length < 2) slug = `org-${payment.userId.slice(-8)}`;

      const taken = await tx.organization.findUnique({ where: { slug } });
      if (taken) {
        slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      }

      const periodEnd = addBillingPeriod(now, plan);
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          currency: "ARS",
          enabledCurrencies: ["ARS", "USD"],
          themeId: "obra",
          country: "AR",
          billingStatus: "ACTIVE",
          billingPlan: plan,
          paidUntil: periodEnd,
          members: {
            create: {
              userId: payment.userId,
              role: "ADMIN",
              allowedModules: [],
            },
          },
        },
      });
      organizationId = org.id;

      const approved = await tx.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: "APPROVED",
          organizationId,
          approvedById: opts?.approvedById ?? null,
          mpPaymentId: opts?.mpPaymentId ?? payment.mpPaymentId,
          periodStart: now,
          periodEnd,
        },
      });
      return { payment: approved, freshlyApproved: true };
    }

    const org = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new Error("Empresa no encontrada");

    const base =
      org.paidUntil && org.paidUntil.getTime() > now.getTime()
        ? org.paidUntil
        : now;
    const periodEnd = addBillingPeriod(base, plan);

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        billingStatus: "ACTIVE",
        billingPlan: plan,
        paidUntil: periodEnd,
      },
    });

    const approved = await tx.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: "APPROVED",
        approvedById: opts?.approvedById ?? null,
        mpPaymentId: opts?.mpPaymentId ?? payment.mpPaymentId,
        periodStart: base,
        periodEnd,
      },
    });
    return { payment: approved, freshlyApproved: true };
  });

  if (updated.freshlyApproved && updated.payment.organizationId) {
    const plan =
      normalizeBillingPlanId(updated.payment.plan) ??
      ("TEAM_MONTHLY" as BillingPlanId);
    await applyPromoLockFromPayment(
      updated.payment.id,
      updated.payment.organizationId,
      plan,
    );

    const { notifyBillingPaymentDecision } = await import(
      "@/features/billing/lib/notify-payment-decision"
    );
    // await: en Server Actions / route handlers un void se corta al responder
    const notified = await notifyBillingPaymentDecision({
      paymentId: updated.payment.id,
      decision: "APPROVED",
    });
    if (!notified.whatsapp && !notified.email) {
      console.warn(
        "activateBillingPayment: aprobado pero no se pudo notificar",
        { paymentId: updated.payment.id, ...notified },
      );
    }
  }

  return updated.payment;
}

export async function markOrganizationPastDueIfNeeded(
  organizationId: string,
  tx: Tx | typeof prisma = prisma,
) {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { billingStatus: true, paidUntil: true },
  });
  if (!org || org.billingStatus === "EXEMPT") return;
  if (org.paidUntil && org.paidUntil.getTime() <= Date.now()) {
    if (org.billingStatus !== "PAST_DUE") {
      await tx.organization.update({
        where: { id: organizationId },
        data: { billingStatus: "PAST_DUE" },
      });
    }
  }
}

export function toBillingPlanId(plan: BillingPlan): BillingPlanId {
  return normalizeBillingPlanId(plan) ?? "TEAM_MONTHLY";
}
