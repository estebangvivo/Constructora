import { prisma } from "@/lib/prisma";
import {
  fetchBnaUsdArsQuote,
  todayArgentinaDate,
} from "@/lib/exchange/bna";

export type SyncBnaResult = {
  organizationId: string;
  organizationName: string;
  rate: number;
  buy: number;
  sell: number;
  effectiveAt: string;
  created: boolean;
  updated: boolean;
  source: string;
};

/**
 * Crea o actualiza el registro del día (USD→ARS) con cotización BNA venta
 * para todas las organizaciones (histórico diario).
 */
export async function syncBnaUsdRateForAllOrgs(): Promise<SyncBnaResult[]> {
  const quote = await fetchBnaUsdArsQuote();
  const { ymd, date: effectiveAt } = todayArgentinaDate();
  const notes = `BNA venta ${quote.sell} / compra ${quote.buy} · ${quote.source}`;

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  const results: SyncBnaResult[] = [];

  for (const org of orgs) {
    const existing = await prisma.exchangeRate.findUnique({
      where: {
        organizationId_fromCurrency_toCurrency_effectiveAt: {
          organizationId: org.id,
          fromCurrency: "USD",
          toCurrency: "ARS",
          effectiveAt,
        },
      },
    });

    await prisma.exchangeRate.upsert({
      where: {
        organizationId_fromCurrency_toCurrency_effectiveAt: {
          organizationId: org.id,
          fromCurrency: "USD",
          toCurrency: "ARS",
          effectiveAt,
        },
      },
      create: {
        organizationId: org.id,
        fromCurrency: "USD",
        toCurrency: "ARS",
        rate: quote.rate,
        effectiveAt,
        notes,
      },
      update: {
        rate: quote.rate,
        notes,
      },
    });

    results.push({
      organizationId: org.id,
      organizationName: org.name,
      rate: quote.rate,
      buy: quote.buy,
      sell: quote.sell,
      effectiveAt: ymd,
      created: !existing,
      updated: Boolean(existing),
      source: quote.source,
    });
  }

  return results;
}

/** Si falta el registro de hoy, lo sincroniza (útil en desarrollo / primer acceso). */
export async function ensureTodayBnaRate(
  organizationId: string,
): Promise<SyncBnaResult | null> {
  const { ymd, date: effectiveAt } = todayArgentinaDate();
  const existing = await prisma.exchangeRate.findUnique({
    where: {
      organizationId_fromCurrency_toCurrency_effectiveAt: {
        organizationId,
        fromCurrency: "USD",
        toCurrency: "ARS",
        effectiveAt,
      },
    },
  });
  if (existing) return null;

  const results = await syncBnaUsdRateForAllOrgs();
  return results.find((r) => r.organizationId === organizationId) ?? null;
}
