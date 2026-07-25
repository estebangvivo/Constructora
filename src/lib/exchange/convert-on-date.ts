import { Prisma } from "@prisma/client";
import { normalizeCurrency } from "@/config/currencies";

type Db = {
  exchangeRate: {
    findFirst: (args: {
      where: {
        organizationId: string;
        fromCurrency: string;
        toCurrency: string;
        effectiveAt: { lte: Date };
      };
      orderBy: { effectiveAt: "desc" };
    }) => Promise<{ rate: Prisma.Decimal | number } | null>;
  };
};

function toNumber(value: { toNumber(): number } | number | Prisma.Decimal): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value);
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatIsoDate(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

/** Tipo de cambio vigente en `onDate` (o null si no hay cotización). */
export async function findExchangeRateOnDate(
  db: Db,
  organizationId: string,
  fromCurrency: string,
  toCurrency: string,
  onDate: Date,
): Promise<number | null> {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return 1;

  const day = startOfUtcDay(onDate);

  const direct = await db.exchangeRate.findFirst({
    where: {
      organizationId,
      fromCurrency: from,
      toCurrency: to,
      effectiveAt: { lte: day },
    },
    orderBy: { effectiveAt: "desc" },
  });
  if (direct) return toNumber(direct.rate);

  const inverse = await db.exchangeRate.findFirst({
    where: {
      organizationId,
      fromCurrency: to,
      toCurrency: from,
      effectiveAt: { lte: day },
    },
    orderBy: { effectiveAt: "desc" },
  });
  if (inverse) {
    const rate = toNumber(inverse.rate);
    if (rate) return 1 / rate;
  }

  return null;
}

/**
 * Convierte un monto con el TC vigente a la fecha del documento.
 * Lanza error si hace falta cotización y no hay ninguna cargada.
 */
export async function convertAmountOnDate(
  db: Db,
  organizationId: string,
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  onDate: Date,
): Promise<number> {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (!amount) return 0;
  if (from === to) return Math.round(amount * 100) / 100;

  const rate = await findExchangeRateOnDate(
    db,
    organizationId,
    from,
    to,
    onDate,
  );
  if (rate == null) {
    throw new Error(
      `No hay tipo de cambio ${from}→${to} vigente al ${formatIsoDate(onDate)}. Cargalo en Ajustes → Cotizaciones.`,
    );
  }

  return Math.round(amount * rate * 100) / 100;
}

/** Convierte sin lanzar: si no hay TC, devuelve null. */
export async function tryConvertAmountOnDate(
  db: Db,
  organizationId: string,
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  onDate: Date,
): Promise<number | null> {
  try {
    return await convertAmountOnDate(
      db,
      organizationId,
      amount,
      fromCurrency,
      toCurrency,
      onDate,
    );
  } catch {
    return null;
  }
}
