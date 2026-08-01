import { prisma } from "@/lib/prisma";

/**
 * Tipo USD→ARS para facturación (cualquier org, o fallback env).
 */
export async function getBillingUsdArsRate(): Promise<number | null> {
  const row = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: "USD",
      toCurrency: "ARS",
      effectiveAt: { lte: new Date() },
    },
    orderBy: { effectiveAt: "desc" },
    select: { rate: true },
  });
  if (row) {
    const n = typeof row.rate === "number" ? row.rate : Number(row.rate);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const inverse = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: "ARS",
      toCurrency: "USD",
      effectiveAt: { lte: new Date() },
    },
    orderBy: { effectiveAt: "desc" },
    select: { rate: true },
  });
  if (inverse) {
    const n =
      typeof inverse.rate === "number" ? inverse.rate : Number(inverse.rate);
    if (Number.isFinite(n) && n > 0) return 1 / n;
  }

  const fallback = Number(process.env.BILLING_USD_ARS_FALLBACK ?? "");
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}
