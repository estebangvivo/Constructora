import type { BillingStatus } from "@prisma/client";
import { normalizeBillingPlanId } from "@/features/billing/lib/plans";

export type OrgBillingSnapshot = {
  billingStatus: BillingStatus;
  paidUntil: Date | null;
  billingPlan?: string | null;
};

/** Acceso completo al ERP (no solo billing/onboarding). */
export function organizationHasAppAccess(org: OrgBillingSnapshot): boolean {
  if (org.billingStatus === "EXEMPT") return true;
  if (org.billingStatus === "ACTIVE" && org.paidUntil) {
    return org.paidUntil.getTime() > Date.now();
  }
  return false;
}

export function organizationNeedsRenewal(org: OrgBillingSnapshot): boolean {
  if (org.billingStatus === "EXEMPT") return false;
  if (!org.paidUntil) return true;
  return org.paidUntil.getTime() <= Date.now();
}

export function organizationIsTrialPlan(org: {
  billingPlan?: string | null;
  billingStatus?: BillingStatus;
}): boolean {
  if (org.billingStatus === "EXEMPT") return false;
  return normalizeBillingPlanId(org.billingPlan) === "TRIAL";
}

/** Días de prueba restantes (ceil). null si no hay fecha. */
export function trialDaysRemaining(
  paidUntil: Date | null | undefined,
): number | null {
  if (!paidUntil) return null;
  const ms = paidUntil.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
