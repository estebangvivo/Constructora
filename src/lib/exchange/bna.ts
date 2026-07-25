/**
 * Cotización USD del Banco Nación (BNA).
 * Fuente primaria: MonedAPI (origin BNA). Fallback: dolarapi oficial.
 */

export type BnaUsdQuote = {
  buy: number;
  sell: number;
  /** Usamos venta como tipo de cambio operativo USD→ARS */
  rate: number;
  source: "monedapi-bna" | "dolarapi-oficial";
  updatedAt: string | null;
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al consultar ${url}`);
  }
  return res.json();
}

function asPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function fetchBnaUsdArsQuote(): Promise<BnaUsdQuote> {
  try {
    const data = (await fetchJson("https://monedapi.ar/api/v2/usd/bna")) as {
      origin?: string;
      buy?: number;
      sell?: number;
      updatedAt?: string;
    };

    const buy = asPositiveNumber(data.buy);
    const sell = asPositiveNumber(data.sell);
    if (buy && sell) {
      return {
        buy,
        sell,
        rate: sell,
        source: "monedapi-bna",
        updatedAt: data.updatedAt ?? null,
      };
    }
  } catch (error) {
    console.warn("fetchBnaUsdArsQuote monedapi", error);
  }

  const data = (await fetchJson(
    "https://dolarapi.com/v1/dolares/oficial",
  )) as {
    compra?: number;
    venta?: number;
    fechaActualizacion?: string;
  };

  const buy = asPositiveNumber(data.compra);
  const sell = asPositiveNumber(data.venta);
  if (!buy || !sell) {
    throw new Error("No se pudo obtener la cotización del dólar BNA.");
  }

  return {
    buy,
    sell,
    rate: sell,
    source: "dolarapi-oficial",
    updatedAt: data.fechaActualizacion ?? null,
  };
}

/** Fecha calendario en Argentina (YYYY-MM-DD → Date UTC noon-safe). */
export function todayArgentinaDate(): { ymd: string; date: Date } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = ymd.split("-").map(Number);
  return { ymd, date: new Date(Date.UTC(y, m - 1, d)) };
}
