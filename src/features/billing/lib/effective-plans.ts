import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BILLING_PLANS,
  type BillingPlanId,
  type PaidBillingPlanId,
  PAID_BILLING_PLANS,
} from "@/features/billing/lib/plans";

const SETTINGS_ID = "default";

export type PlanPriceOverride = {
  priceUsd?: number;
  /** null = sin precio ARS fijo (usar USD). */
  priceArs?: number | null;
};

export type PlanPricesMap = Partial<Record<BillingPlanId, PlanPriceOverride>>;

export type EffectivePlanPrices = Record<
  BillingPlanId,
  { priceUsd: number; priceArs: number | null }
>;

export type PlanCheckoutCharge = {
  currency: "USD" | "ARS";
  amount: number;
};

function defaultPrices(): EffectivePlanPrices {
  const out = {} as EffectivePlanPrices;
  for (const id of Object.keys(BILLING_PLANS) as BillingPlanId[]) {
    const def = BILLING_PLANS[id];
    out[id] = {
      priceUsd: def.priceUsd,
      priceArs:
        "priceArs" in def && typeof def.priceArs === "number"
          ? def.priceArs
          : null,
    };
  }
  return out;
}

function parseOverrides(raw: unknown): PlanPricesMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: PlanPricesMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in BILLING_PLANS)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const entry: PlanPriceOverride = {};
    if (typeof row.priceUsd === "number" && Number.isFinite(row.priceUsd)) {
      entry.priceUsd = Math.max(0, row.priceUsd);
    }
    if (row.priceArs === null) {
      entry.priceArs = null;
    } else if (
      typeof row.priceArs === "number" &&
      Number.isFinite(row.priceArs)
    ) {
      entry.priceArs = Math.max(0, row.priceArs);
    }
    out[key as BillingPlanId] = entry;
  }
  return out;
}

export async function getPlanPriceOverrides(): Promise<PlanPricesMap> {
  try {
    const row = await prisma.platformBillingSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { planPrices: true },
    });
    return parseOverrides(row?.planPrices);
  } catch (error) {
    console.warn("getPlanPriceOverrides", error);
    return {};
  }
}

export async function getEffectivePlanPrices(): Promise<EffectivePlanPrices> {
  const base = defaultPrices();
  const overrides = await getPlanPriceOverrides();
  for (const id of Object.keys(base) as BillingPlanId[]) {
    const o = overrides[id];
    if (!o) continue;
    if (typeof o.priceUsd === "number") base[id].priceUsd = o.priceUsd;
    if (o.priceArs === null) base[id].priceArs = null;
    else if (typeof o.priceArs === "number") base[id].priceArs = o.priceArs;
  }
  return base;
}

export async function planPriceUsdEffective(
  plan: BillingPlanId,
): Promise<number> {
  const prices = await getEffectivePlanPrices();
  return prices[plan].priceUsd;
}

export async function planCheckoutChargeEffective(
  plan: BillingPlanId,
): Promise<PlanCheckoutCharge> {
  const prices = await getEffectivePlanPrices();
  const row = prices[plan];
  if (row.priceArs != null) {
    return { currency: "ARS", amount: row.priceArs };
  }
  return { currency: "USD", amount: row.priceUsd };
}

export type MercadoPagoCharge = PlanCheckoutCharge & {
  baseAmount: number;
  surchargePercent: number;
};

/** Precio del plan + recargo % de Mercado Pago (configurable en admin). */
export async function planMercadoPagoChargeEffective(
  plan: BillingPlanId,
): Promise<MercadoPagoCharge> {
  const base = await planCheckoutChargeEffective(plan);
  const { getMpSurchargePercent } = await import(
    "@/features/billing/lib/platform-billing-settings"
  );
  const surchargePercent = await getMpSurchargePercent();
  const amount =
    Math.round(base.amount * (1 + surchargePercent / 100) * 100) / 100;
  return {
    currency: base.currency,
    amount,
    baseAmount: base.amount,
    surchargePercent,
  };
}

export function formatChargeLabel(charge: PlanCheckoutCharge): string {
  if (charge.amount <= 0) return "Gratis";
  if (charge.currency === "ARS") {
    return `$ ${charge.amount.toLocaleString("es-AR")} ARS`;
  }
  return `USD ${charge.amount}`;
}

export async function formatPlanPriceLabelEffective(
  plan: BillingPlanId,
): Promise<string> {
  return formatChargeLabel(await planCheckoutChargeEffective(plan));
}

export async function upsertPlanPrices(input: {
  prices: PlanPricesMap;
  updatedByUserId?: string | null;
}): Promise<void> {
  const sanitized: PlanPricesMap = {};
  for (const id of Object.keys(BILLING_PLANS) as BillingPlanId[]) {
    const row = input.prices[id];
    if (!row) continue;
    const entry: PlanPriceOverride = {};
    if (typeof row.priceUsd === "number" && Number.isFinite(row.priceUsd)) {
      entry.priceUsd = Math.round(Math.max(0, row.priceUsd) * 100) / 100;
    }
    if (row.priceArs === null) {
      entry.priceArs = null;
    } else if (
      typeof row.priceArs === "number" &&
      Number.isFinite(row.priceArs)
    ) {
      entry.priceArs = Math.round(Math.max(0, row.priceArs) * 100) / 100;
    }
    if (Object.keys(entry).length > 0) {
      sanitized[id] = entry;
    }
  }

  const json = sanitized as Prisma.InputJsonValue;
  await prisma.platformBillingSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      planPrices: json,
      updatedByUserId: input.updatedByUserId ?? null,
    },
    update: {
      planPrices: json,
      updatedByUserId: input.updatedByUserId ?? null,
    },
  });
}

/** Filas editables para el panel admin. */
export async function getAdminPlanPricesEditor(): Promise<
  Array<{
    id: BillingPlanId;
    label: string;
    isTrial: boolean;
    priceUsd: number;
    priceArs: number | null;
    defaultPriceUsd: number;
    defaultPriceArs: number | null;
  }>
> {
  const effective = await getEffectivePlanPrices();
  const defaults = defaultPrices();
  const order: BillingPlanId[] = [
    "TRIAL",
    ...(Object.keys(PAID_BILLING_PLANS) as PaidBillingPlanId[]),
  ];
  return order.map((id) => ({
    id,
    label: BILLING_PLANS[id].label,
    isTrial: BILLING_PLANS[id].isTrial,
    priceUsd: effective[id].priceUsd,
    priceArs: effective[id].priceArs,
    defaultPriceUsd: defaults[id].priceUsd,
    defaultPriceArs: defaults[id].priceArs,
  }));
}
