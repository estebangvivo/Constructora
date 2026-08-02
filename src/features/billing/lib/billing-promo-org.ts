import { prisma } from "@/lib/prisma";

export type OrgBillingPromo = {
  percent: number | null;
  until: Date | null;
};

export function addCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Evitar desborde (ej. 31 ene + 1 mes).
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export async function getOrgBillingPromo(
  organizationId: string,
): Promise<OrgBillingPromo> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        billingPromoPercent: { toString(): string } | number | null;
        billingPromoUntil: Date | null;
      }>
    >`
      SELECT "billingPromoPercent", "billingPromoUntil"
      FROM organizations
      WHERE id = ${organizationId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return { percent: null, until: null };
    const percent =
      row.billingPromoPercent == null
        ? null
        : Number(row.billingPromoPercent);
    return {
      percent:
        percent != null && Number.isFinite(percent) && percent > 0
          ? percent
          : null,
      until: row.billingPromoUntil ?? null,
    };
  } catch (error) {
    console.warn("getOrgBillingPromo", error);
    return { percent: null, until: null };
  }
}

export function isOrgPromoActive(
  promo: OrgBillingPromo,
  now = new Date(),
): boolean {
  return Boolean(
    promo.percent != null &&
      promo.percent > 0 &&
      promo.until &&
      promo.until.getTime() > now.getTime(),
  );
}

/** Lockea o renueva la ventana de promo en la org (planes mensuales). */
export async function lockOrgBillingPromo(input: {
  organizationId: string;
  percent: number;
  months: number;
  from?: Date;
}): Promise<void> {
  const from = input.from ?? new Date();
  const until = addCalendarMonths(from, input.months);
  const percent = Math.min(100, Math.max(0, input.percent));
  try {
    await prisma.$executeRaw`
      UPDATE organizations
      SET
        "billingPromoPercent" = ${percent},
        "billingPromoUntil" = ${until},
        "updatedAt" = NOW()
      WHERE id = ${input.organizationId}
        AND (
          "billingPromoUntil" IS NULL
          OR "billingPromoUntil" <= NOW()
        )
    `;
  } catch (error) {
    console.warn("lockOrgBillingPromo", error);
  }
}

export async function setPaymentPromoMeta(input: {
  paymentId: string;
  discountPercent: number | null;
  promoMonths: number | null;
}): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE billing_payments
      SET
        "discountPercent" = ${input.discountPercent},
        "promoMonths" = ${input.promoMonths},
        "updatedAt" = NOW()
      WHERE id = ${input.paymentId}
    `;
  } catch (error) {
    console.warn("setPaymentPromoMeta", error);
  }
}

/**
 * Campañas globales solo para empresas nuevas:
 * sin pagos APPROVED de plan de pago (no TRIAL).
 * EXEMPT nunca cuenta como nueva. Tampoco quienes ya pagaron un plan.
 */
export async function organizationEligibleForCampaign(
  organizationId: string,
): Promise<boolean> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingStatus: true },
    });
    if (!org || org.billingStatus === "EXEMPT") return false;

    const paid = await prisma.billingPayment.findFirst({
      where: {
        organizationId,
        status: "APPROVED",
        plan: { not: "TRIAL" },
      },
      select: { id: true },
    });
    return !paid;
  } catch (error) {
    console.warn("organizationEligibleForCampaign", error);
    return false;
  }
}

export async function getPaymentPromoMeta(paymentId: string): Promise<{
  discountPercent: number | null;
  promoMonths: number | null;
}> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        discountPercent: { toString(): string } | number | null;
        promoMonths: number | null;
      }>
    >`
      SELECT "discountPercent", "promoMonths"
      FROM billing_payments
      WHERE id = ${paymentId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return { discountPercent: null, promoMonths: null };
    const discountPercent =
      row.discountPercent == null ? null : Number(row.discountPercent);
    return {
      discountPercent:
        discountPercent != null && Number.isFinite(discountPercent)
          ? discountPercent
          : null,
      promoMonths:
        row.promoMonths != null && row.promoMonths > 0
          ? row.promoMonths
          : null,
    };
  } catch (error) {
    console.warn("getPaymentPromoMeta", error);
    return { discountPercent: null, promoMonths: null };
  }
}
