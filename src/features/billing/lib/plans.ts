/** Precios y cupos SaaS (USD). `maxUsers: null` = sin límite. */

export type BillingCycle = "MONTHLY" | "ANNUAL";

export type BillingTierId = "SOLO" | "TEAM" | "UNLIMITED";

type PlanDef = {
  id: string;
  label: string;
  priceUsd: number;
  /** Precio fijo en ARS (p. ej. prueba de pasarela). Si está, el checkout usa ARS. */
  priceArs?: number;
  days: number;
  cycle: BillingCycle;
  tier: BillingTierId | "TRIAL";
  /** null = usuarios ilimitados */
  maxUsers: number | null;
  description: string;
  isTrial: boolean;
};

export const BILLING_PLANS = {
  TRIAL: {
    id: "TRIAL",
    label: "Prueba 30 días",
    priceUsd: 0,
    /** Precio editable en Administración → Precios. 0 = gratis. */
    priceArs: 0,
    days: 30,
    cycle: "MONTHLY",
    tier: "TRIAL",
    maxUsers: 1,
    description:
      "30 días con 1 usuario. Para sumar personas, contratá un plan de pago.",
    isTrial: true,
  },
  SOLO_MONTHLY: {
    id: "SOLO_MONTHLY",
    label: "Unipersonal · mensual",
    priceUsd: 59,
    days: 30,
    cycle: "MONTHLY",
    tier: "SOLO",
    maxUsers: 1,
    description: "1 usuario por empresa. Ideal para independientes.",
    isTrial: false,
  },
  SOLO_ANNUAL: {
    id: "SOLO_ANNUAL",
    label: "Unipersonal · anual",
    priceUsd: 599,
    days: 365,
    cycle: "ANNUAL",
    tier: "SOLO",
    maxUsers: 1,
    description: "1 usuario por empresa. Pago anual (ahorrás vs mes a mes).",
    isTrial: false,
  },
  TEAM_MONTHLY: {
    id: "TEAM_MONTHLY",
    label: "Equipo · mensual",
    priceUsd: 99,
    days: 30,
    cycle: "MONTHLY",
    tier: "TEAM",
    maxUsers: 5,
    description: "Hasta 5 usuarios por empresa.",
    isTrial: false,
  },
  TEAM_ANNUAL: {
    id: "TEAM_ANNUAL",
    label: "Equipo · anual",
    priceUsd: 999,
    days: 365,
    cycle: "ANNUAL",
    tier: "TEAM",
    maxUsers: 5,
    description: "Hasta 5 usuarios por empresa. Pago anual.",
    isTrial: false,
  },
  UNLIMITED_MONTHLY: {
    id: "UNLIMITED_MONTHLY",
    label: "Ilimitado · mensual",
    priceUsd: 119,
    days: 30,
    cycle: "MONTHLY",
    tier: "UNLIMITED",
    maxUsers: null,
    description: "Usuarios ilimitados por empresa.",
    isTrial: false,
  },
  UNLIMITED_ANNUAL: {
    id: "UNLIMITED_ANNUAL",
    label: "Ilimitado · anual",
    priceUsd: 1199,
    days: 365,
    cycle: "ANNUAL",
    tier: "UNLIMITED",
    maxUsers: null,
    description: "Usuarios ilimitados. Pago anual.",
    isTrial: false,
  },
} as const satisfies Record<string, PlanDef>;

export type BillingPlanId = keyof typeof BILLING_PLANS;

/** Planes de pago (sin prueba). */
export const PAID_BILLING_PLANS = {
  SOLO_MONTHLY: BILLING_PLANS.SOLO_MONTHLY,
  SOLO_ANNUAL: BILLING_PLANS.SOLO_ANNUAL,
  TEAM_MONTHLY: BILLING_PLANS.TEAM_MONTHLY,
  TEAM_ANNUAL: BILLING_PLANS.TEAM_ANNUAL,
  UNLIMITED_MONTHLY: BILLING_PLANS.UNLIMITED_MONTHLY,
  UNLIMITED_ANNUAL: BILLING_PLANS.UNLIMITED_ANNUAL,
} as const;

export type PaidBillingPlanId = keyof typeof PAID_BILLING_PLANS;

/** Niveles comerciales para la UI (mensual + anual). */
export const BILLING_TIERS = {
  SOLO: {
    id: "SOLO" as const,
    label: "Unipersonal",
    maxUsers: 1 as number | null,
    usersLabel: "1 usuario",
    monthly: "SOLO_MONTHLY" as PaidBillingPlanId,
    annual: "SOLO_ANNUAL" as PaidBillingPlanId,
    blurb: "Para empresas unipersonales.",
  },
  TEAM: {
    id: "TEAM" as const,
    label: "Equipo",
    maxUsers: 5 as number | null,
    usersLabel: "Hasta 5 usuarios",
    monthly: "TEAM_MONTHLY" as PaidBillingPlanId,
    annual: "TEAM_ANNUAL" as PaidBillingPlanId,
    blurb: "Para equipos chicos de obra / oficina.",
  },
  UNLIMITED: {
    id: "UNLIMITED" as const,
    label: "Ilimitado",
    maxUsers: null as number | null,
    usersLabel: "Usuarios ilimitados",
    monthly: "UNLIMITED_MONTHLY" as PaidBillingPlanId,
    annual: "UNLIMITED_ANNUAL" as PaidBillingPlanId,
    blurb: "Sin tope de usuarios por empresa.",
  },
} as const;

export type BillingTier = typeof BILLING_TIERS;

/**
 * Normaliza valores legacy de Prisma (`MONTHLY` / `ANNUAL` → Equipo).
 */
export function normalizeBillingPlanId(
  plan: string | null | undefined,
): BillingPlanId | null {
  if (!plan) return null;
  if (plan === "MONTHLY") return "TEAM_MONTHLY";
  if (plan === "ANNUAL") return "TEAM_ANNUAL";
  if (plan in BILLING_PLANS) return plan as BillingPlanId;
  return null;
}

export function isPaidBillingPlan(plan: string): plan is PaidBillingPlanId {
  return plan in PAID_BILLING_PLANS;
}

export function planDays(plan: BillingPlanId): number {
  return BILLING_PLANS[plan].days;
}

export function planPriceUsd(plan: BillingPlanId): number {
  return BILLING_PLANS[plan].priceUsd;
}

export function planPriceArs(plan: BillingPlanId): number | null {
  const def = BILLING_PLANS[plan] as PlanDef;
  return typeof def.priceArs === "number" ? def.priceArs : null;
}

/** Monto y moneda para checkout (MP / transferencia). */
export function planCheckoutCharge(plan: BillingPlanId): {
  currency: "USD" | "ARS";
  amount: number;
} {
  const ars = planPriceArs(plan);
  if (ars != null) return { currency: "ARS", amount: ars };
  return { currency: "USD", amount: planPriceUsd(plan) };
}

export function formatPlanPriceLabel(plan: BillingPlanId): string {
  const charge = planCheckoutCharge(plan);
  if (charge.amount <= 0) return "Gratis";
  if (charge.currency === "ARS") {
    return `$ ${charge.amount.toLocaleString("es-AR")} ARS`;
  }
  return `USD ${charge.amount}`;
}

export function planMaxUsers(plan: BillingPlanId): number | null {
  return BILLING_PLANS[plan].maxUsers;
}

export function planIsMonthlyCycle(plan: BillingPlanId): boolean {
  return BILLING_PLANS[plan].cycle === "MONTHLY";
}

export function formatPlanUsersLabel(maxUsers: number | null): string {
  if (maxUsers == null) return "Usuarios ilimitados";
  if (maxUsers === 1) return "1 usuario";
  return `Hasta ${maxUsers} usuarios`;
}

export function addBillingPeriod(from: Date, plan: BillingPlanId): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + planDays(plan));
  return end;
}
