import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { normalizeCurrency } from "@/config/currencies";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ExchangeRateView = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveAt: string;
  notes: string | null;
};

/** Último tipo de cambio vigente (o null). */
export async function getLatestExchangeRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<ExchangeRateView | null> {
  const session = await requireSession();
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) {
    return {
      id: "identity",
      fromCurrency: from,
      toCurrency: to,
      rate: 1,
      effectiveAt: new Date().toISOString().slice(0, 10),
      notes: null,
    };
  }

  const row = await prisma.exchangeRate.findFirst({
    where: {
      organizationId: session.organizationId,
      fromCurrency: from,
      toCurrency: to,
      effectiveAt: { lte: new Date() },
    },
    orderBy: { effectiveAt: "desc" },
  });

  if (!row) return null;

  return {
    id: row.id,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: toNumber(row.rate),
    effectiveAt: row.effectiveAt.toISOString().slice(0, 10),
    notes: row.notes,
  };
}

export async function listRecentExchangeRates(
  limit = 10,
): Promise<ExchangeRateView[]> {
  const session = await requireSession();
  const rows = await prisma.exchangeRate.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: toNumber(row.rate),
    effectiveAt: row.effectiveAt.toISOString().slice(0, 10),
    notes: row.notes,
  }));
}

/** Convierte monto usando el último TC conocido. */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return amount;

  const direct = await getLatestExchangeRate(from, to);
  if (direct) return amount * direct.rate;

  const inverse = await getLatestExchangeRate(to, from);
  if (inverse && inverse.rate) return amount / inverse.rate;

  return null;
}
