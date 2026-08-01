import { prisma } from "@/lib/prisma";
import {
  BILLING_PLANS,
  formatPlanUsersLabel,
  normalizeBillingPlanId,
  planMaxUsers,
} from "@/features/billing/lib/plans";

/**
 * Verifica que la empresa pueda sumar `addCount` miembros según el plan.
 * EXEMPT no limita. Prueba gratis: no permite altas hasta contratar un plan.
 */
export async function assertOrgCanAddMembers(
  organizationId: string,
  addCount = 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (addCount <= 0) return { ok: true };

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      billingStatus: true,
      billingPlan: true,
      _count: { select: { members: true } },
    },
  });
  if (!org) return { ok: false, error: "Empresa no encontrada." };
  if (org.billingStatus === "EXEMPT") return { ok: true };

  const planId = normalizeBillingPlanId(org.billingPlan);
  if (!planId) {
    return {
      ok: false,
      error: "La empresa no tiene un plan activo para sumar usuarios.",
    };
  }

  if (planId === "TRIAL" || BILLING_PLANS[planId].isTrial) {
    return {
      ok: false,
      error:
        "En la prueba gratis no podés dar de alta usuarios. Contratá un plan en Suscripción.",
    };
  }

  const max = planMaxUsers(planId);
  if (max == null) return { ok: true };

  const current = org._count.members;
  if (current + addCount > max) {
    return {
      ok: false,
      error: `Tu plan permite ${formatPlanUsersLabel(max).toLowerCase()}. Tenés ${current} y no podés sumar más. Mejorá de plan en Suscripción.`,
    };
  }

  return { ok: true };
}

/** true si la org está en prueba y no debería permitir altas de usuarios. */
export async function organizationIsOnTrial(
  organizationId: string,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { billingStatus: true, billingPlan: true },
  });
  if (!org || org.billingStatus === "EXEMPT") return false;
  const planId = normalizeBillingPlanId(org.billingPlan);
  return planId === "TRIAL";
}
