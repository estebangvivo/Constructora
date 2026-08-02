import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BILLING_PLANS,
  planIsMonthlyCycle,
  type BillingPlanId,
  type PaidBillingPlanId,
  PAID_BILLING_PLANS,
} from "@/features/billing/lib/plans";
import {
  getOrgBillingPromo,
  isOrgPromoActive,
  organizationEligibleForCampaign,
} from "@/features/billing/lib/billing-promo-org";

const SETTINGS_ID = "default";

export type PlanPriceOverride = {
  priceUsd?: number;
  /** null = sin precio ARS fijo (usar USD). */
  priceArs?: number | null;
  /** 0–100. Requiere discountUntil para aplicarse. */
  discountPercent?: number | null;
  /** YYYY-MM-DD inclusive (fecha límite para contratar la promo). */
  discountUntil?: string | null;
  /**
   * Meses con descuento en planes mensuales si contratás antes de discountUntil.
   * Después de esos meses, renovás al precio de lista.
   */
  discountPromoMonths?: number | null;
};

export type PlanPricesMap = Partial<Record<BillingPlanId, PlanPriceOverride>>;

export type EffectivePlanPrice = {
  /** Precio de lista (sin descuento). */
  listPriceUsd: number;
  listPriceArs: number | null;
  /** Precio a cobrar (con descuento si está vigente). */
  priceUsd: number;
  priceArs: number | null;
  /** Solo si el descuento está vigente ahora. */
  discountPercent: number | null;
  /** YYYY-MM-DD si el descuento está vigente. */
  discountUntil: string | null;
  /** Meses de promo (campaña) si el descuento está vigente. */
  discountPromoMonths: number | null;
};

export type EffectivePlanPrices = Record<BillingPlanId, EffectivePlanPrice>;

export type PlanCheckoutCharge = {
  currency: "USD" | "ARS";
  amount: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function applyPercentDiscount(amount: number, percent: number): number {
  return roundMoney(amount * (1 - percent / 100));
}

/** Fecha calendario YYYY-MM-DD (hoy en zona local del servidor). */
export function todayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeDiscountUntil(
  raw: unknown,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return trimmed;
}

export function normalizeDiscountPercent(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function normalizeDiscountPromoMonths(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(36, Math.round(n));
}

export function isPlanDiscountActive(
  percent: number | null | undefined,
  until: string | null | undefined,
  now = new Date(),
): boolean {
  const p = normalizeDiscountPercent(percent);
  const u = normalizeDiscountUntil(until);
  if (p == null || u == null) return false;
  return todayDateKey(now) <= u;
}

function defaultListPrices(): Record<
  BillingPlanId,
  { priceUsd: number; priceArs: number | null }
> {
  const out = {} as Record<
    BillingPlanId,
    { priceUsd: number; priceArs: number | null }
  >;
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
    if (row.discountPercent === null) {
      entry.discountPercent = null;
    } else {
      const dp = normalizeDiscountPercent(row.discountPercent);
      if (dp != null) entry.discountPercent = dp;
    }
    if (row.discountUntil === null || row.discountUntil === "") {
      entry.discountUntil = null;
    } else {
      const du = normalizeDiscountUntil(row.discountUntil);
      if (du) entry.discountUntil = du;
    }
    if (row.discountPromoMonths === null) {
      entry.discountPromoMonths = null;
    } else {
      const months = normalizeDiscountPromoMonths(row.discountPromoMonths);
      if (months != null) entry.discountPromoMonths = months;
    }
    out[key as BillingPlanId] = entry;
  }
  return out;
}

function buildEffective(
  listUsd: number,
  listArs: number | null,
  discountPercent: number | null,
  discountUntil: string | null,
  discountPromoMonths: number | null,
): EffectivePlanPrice {
  const active = isPlanDiscountActive(discountPercent, discountUntil);
  const percent = active ? discountPercent : null;
  const until = active ? discountUntil : null;
  const months =
    active && discountPromoMonths != null ? discountPromoMonths : null;
  return {
    listPriceUsd: listUsd,
    listPriceArs: listArs,
    priceUsd:
      percent != null ? applyPercentDiscount(listUsd, percent) : listUsd,
    priceArs:
      listArs == null
        ? null
        : percent != null
          ? applyPercentDiscount(listArs, percent)
          : listArs,
    discountPercent: percent,
    discountUntil: until,
    discountPromoMonths: months,
  };
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
  const lists = defaultListPrices();
  const overrides = await getPlanPriceOverrides();
  const out = {} as EffectivePlanPrices;
  for (const id of Object.keys(lists) as BillingPlanId[]) {
    const o = overrides[id];
    const listUsd =
      typeof o?.priceUsd === "number" ? o.priceUsd : lists[id].priceUsd;
    let listArs = lists[id].priceArs;
    if (o && "priceArs" in o) {
      listArs = o.priceArs ?? null;
    }
    const discountPercent =
      o?.discountPercent === null
        ? null
        : (normalizeDiscountPercent(o?.discountPercent) ?? null);
    const discountUntil =
      o?.discountUntil === null || o?.discountUntil === ""
        ? null
        : (normalizeDiscountUntil(o?.discountUntil) ?? null);
    const discountPromoMonths =
      o?.discountPromoMonths === null
        ? null
        : (normalizeDiscountPromoMonths(o?.discountPromoMonths) ?? null);
    out[id] = buildEffective(
      listUsd,
      listArs,
      discountPercent,
      discountUntil,
      discountPromoMonths,
    );
  }
  return out;
}

export type ResolvedPlanQuote = {
  listPriceUsd: number;
  listPriceArs: number | null;
  priceUsd: number;
  priceArs: number | null;
  discountPercent: number | null;
  /** Fecha límite de la campaña (YYYY-MM-DD) o null. */
  discountUntil: string | null;
  discountPromoMonths: number | null;
  /** Origen del descuento aplicado al monto. */
  source: "none" | "campaign" | "org";
  /**
   * Meses a lockear en la org al aprobar este pago
   * (solo campaña + plan mensual + meses configurados).
   */
  grantPromoMonths: number | null;
};

function applyPercentToList(
  listUsd: number,
  listArs: number | null,
  percent: number | null,
): Pick<ResolvedPlanQuote, "priceUsd" | "priceArs"> {
  if (percent == null) {
    return { priceUsd: listUsd, priceArs: listArs };
  }
  return {
    priceUsd: applyPercentDiscount(listUsd, percent),
    priceArs:
      listArs == null ? null : applyPercentDiscount(listArs, percent),
  };
}

/**
 * Precio a cobrar para un actor.
 * - Promo lockeada en la org (mensual): sigue vigente aunque la campaña haya cerrado.
 * - Campaña global: solo altas nuevas (sin org, o empresa sin pagos de plan pagos).
 *   No aplica a renovaciones de empresas que ya contrataron un plan de pago.
 */
export async function resolvePlanQuote(input: {
  plan: BillingPlanId;
  organizationId?: string | null;
}): Promise<ResolvedPlanQuote> {
  const prices = await getEffectivePlanPrices();
  const row = prices[input.plan];
  const listUsd = row.listPriceUsd;
  const listArs = row.listPriceArs;
  const monthly = planIsMonthlyCycle(input.plan);

  if (input.organizationId && monthly) {
    const orgPromo = await getOrgBillingPromo(input.organizationId);
    if (isOrgPromoActive(orgPromo) && orgPromo.percent != null) {
      const priced = applyPercentToList(listUsd, listArs, orgPromo.percent);
      return {
        listPriceUsd: listUsd,
        listPriceArs: listArs,
        ...priced,
        discountPercent: orgPromo.percent,
        discountUntil: null,
        discountPromoMonths: null,
        source: "org",
        grantPromoMonths: null,
      };
    }
  }

  const canUseCampaign = input.organizationId
    ? await organizationEligibleForCampaign(input.organizationId)
    : true;

  if (canUseCampaign && row.discountPercent != null) {
    const priced = applyPercentToList(
      listUsd,
      listArs,
      row.discountPercent,
    );
    const grant =
      monthly && row.discountPromoMonths != null
        ? row.discountPromoMonths
        : null;
    return {
      listPriceUsd: listUsd,
      listPriceArs: listArs,
      ...priced,
      discountPercent: row.discountPercent,
      discountUntil: row.discountUntil,
      discountPromoMonths: row.discountPromoMonths,
      source: "campaign",
      grantPromoMonths: grant,
    };
  }

  return {
    listPriceUsd: listUsd,
    listPriceArs: listArs,
    priceUsd: listUsd,
    priceArs: listArs,
    discountPercent: null,
    discountUntil: null,
    discountPromoMonths: null,
    source: "none",
    grantPromoMonths: null,
  };
}

export async function planPriceUsdEffective(
  plan: BillingPlanId,
): Promise<number> {
  const prices = await getEffectivePlanPrices();
  return prices[plan].priceUsd;
}

export async function planCheckoutChargeEffective(
  plan: BillingPlanId,
  organizationId?: string | null,
): Promise<PlanCheckoutCharge> {
  const quote = await resolvePlanQuote({ plan, organizationId });
  if (quote.priceArs != null) {
    return { currency: "ARS", amount: quote.priceArs };
  }
  return { currency: "USD", amount: quote.priceUsd };
}

export type MercadoPagoCharge = PlanCheckoutCharge & {
  baseAmount: number;
  surchargePercent: number;
};

/** Precio del plan + recargo % de Mercado Pago (configurable en admin). */
export async function planMercadoPagoChargeEffective(
  plan: BillingPlanId,
  organizationId?: string | null,
): Promise<MercadoPagoCharge> {
  const base = await planCheckoutChargeEffective(plan, organizationId);
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
      entry.priceUsd = roundMoney(Math.max(0, row.priceUsd));
    }
    if (row.priceArs === null) {
      entry.priceArs = null;
    } else if (
      typeof row.priceArs === "number" &&
      Number.isFinite(row.priceArs)
    ) {
      entry.priceArs = roundMoney(Math.max(0, row.priceArs));
    }
    if (row.discountPercent === null) {
      entry.discountPercent = null;
    } else {
      const dp = normalizeDiscountPercent(row.discountPercent);
      entry.discountPercent = dp;
    }
    if (row.discountUntil === null || row.discountUntil === "") {
      entry.discountUntil = null;
    } else {
      entry.discountUntil = normalizeDiscountUntil(row.discountUntil);
    }
    if (row.discountPromoMonths === null) {
      entry.discountPromoMonths = null;
    } else {
      entry.discountPromoMonths = normalizeDiscountPromoMonths(
        row.discountPromoMonths,
      );
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

/** Filas editables para el panel admin (precios de lista + descuento configurado). */
export async function getAdminPlanPricesEditor(): Promise<
  Array<{
    id: BillingPlanId;
    label: string;
    isTrial: boolean;
    priceUsd: number;
    priceArs: number | null;
    discountPercent: number | null;
    discountUntil: string | null;
    discountPromoMonths: number | null;
    defaultPriceUsd: number;
    defaultPriceArs: number | null;
  }>
> {
  const lists = defaultListPrices();
  const overrides = await getPlanPriceOverrides();
  const order: BillingPlanId[] = [
    "TRIAL",
    ...(Object.keys(PAID_BILLING_PLANS) as PaidBillingPlanId[]),
  ];
  return order.map((id) => {
    const o = overrides[id];
    const priceUsd =
      typeof o?.priceUsd === "number" ? o.priceUsd : lists[id].priceUsd;
    let priceArs = lists[id].priceArs;
    if (o && "priceArs" in o) priceArs = o.priceArs ?? null;
    return {
      id,
      label: BILLING_PLANS[id].label,
      isTrial: BILLING_PLANS[id].isTrial,
      priceUsd,
      priceArs,
      discountPercent: normalizeDiscountPercent(o?.discountPercent),
      discountUntil: normalizeDiscountUntil(o?.discountUntil),
      discountPromoMonths: normalizeDiscountPromoMonths(
        o?.discountPromoMonths,
      ),
      defaultPriceUsd: lists[id].priceUsd,
      defaultPriceArs: lists[id].priceArs,
    };
  });
}
