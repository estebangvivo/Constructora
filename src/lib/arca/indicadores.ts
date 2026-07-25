import type { ArcaLookupResult, ArcaPersona } from "@/lib/arca/types";
import { formatCuit } from "@/lib/arca/tax-id";

const BASE = "https://indicadores.ar/v1";

export function isIndicadoresConfigured(): boolean {
  return Boolean(process.env.INDICADORES_API_KEY?.trim());
}

function apiKey(): string {
  return process.env.INDICADORES_API_KEY?.trim() || "";
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function mapIndicadoresPayload(
  raw: Record<string, unknown>,
  cuit: string,
  personType: ArcaPersona["personType"],
): ArcaPersona {
  const nested =
    asRecord(raw.data) ??
    asRecord(raw.empresa) ??
    asRecord(raw.persona) ??
    raw;

  const name =
    pickString(nested, [
      "razon_social",
      "razonSocial",
      "nombre",
      "name",
      "denominacion",
    ]) || `CUIT ${formatCuit(cuit)}`;

  const domicilio =
    asRecord(nested.domicilio) ??
    asRecord(nested.domicilio_fiscal) ??
    asRecord(nested.direccion) ??
    nested;

  const street = pickString(domicilio, [
    "direccion",
    "calle",
    "domicilio",
    "address",
    "domicilio_fiscal",
  ]);
  const city = pickString(domicilio, ["localidad", "ciudad", "city"]);
  const state = pickString(domicilio, [
    "provincia",
    "jurisdiccion",
    "state",
    "descripcionProvincia",
  ]);
  const postalCode =
    pickString(domicilio, ["codigo_postal", "cod_postal", "cp", "codPostal"]) ||
    null;

  const addressParts = [street, city, state].filter(Boolean);

  return {
    taxId: formatCuit(cuit),
    name,
    personType,
    address: addressParts.length ? addressParts.join(", ") : null,
    state: state || null,
    postalCode,
    source: "indicadores",
  };
}

async function fetchIndicadores(
  path: string,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "api-key": apiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  return { status: res.status, json };
}

/** Consulta ficha de empresa o persona por CUIT en Indicadores.ar (sin cert ARCA). */
export async function lookupIndicadoresByCuit(
  cuit: string,
): Promise<ArcaLookupResult> {
  if (!isIndicadoresConfigured()) {
    return {
      ok: false,
      error:
        "Falta INDICADORES_API_KEY. Creá una key gratis en https://indicadores.ar/api-empresas",
      code: "NOT_CONFIGURED",
    };
  }

  try {
    // Primero empresa (mayoría de proveedores / clientes societarios)
    const empresa = await fetchIndicadores(`/empresa?cuit=${cuit}`);
    if (empresa.status === 200 && empresa.json) {
      return {
        ok: true,
        persona: mapIndicadoresPayload(empresa.json, cuit, "JURIDICA"),
      };
    }

    if (empresa.status === 401) {
      return {
        ok: false,
        error: "API key de Indicadores inválida.",
        code: "UPSTREAM",
      };
    }
    if (empresa.status === 402) {
      return {
        ok: false,
        error: "Sin créditos en Indicadores.ar. Recargá créditos o esperá el mes.",
        code: "UPSTREAM",
      };
    }

    // Persona física / CUIL
    const persona = await fetchIndicadores(`/persona?cuit=${cuit}`);
    if (persona.status === 200 && persona.json) {
      return {
        ok: true,
        persona: mapIndicadoresPayload(persona.json, cuit, "FISICA"),
      };
    }

    if (persona.status === 404 || empresa.status === 404) {
      return {
        ok: false,
        error: "No se encontró el CUIT en Indicadores.ar.",
        code: "NOT_FOUND",
      };
    }

    return {
      ok: false,
      error: `Indicadores respondió ${persona.status || empresa.status}.`,
      code: "UPSTREAM",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo consultar Indicadores.ar",
      code: "UPSTREAM",
    };
  }
}
