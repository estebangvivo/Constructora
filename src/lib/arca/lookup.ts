import type { ArcaLookupResult, ArcaPersona } from "@/lib/arca/types";
import {
  cuitCandidatesFromDni,
  detectTaxIdKind,
  digitsOnly,
  formatCuit,
  isValidCuit,
  normalizeTaxIdInput,
} from "@/lib/arca/tax-id";
import {
  isIndicadoresConfigured,
  lookupIndicadoresByCuit,
} from "@/lib/arca/indicadores";

const AFIPSDK_BASE = "https://app.afipsdk.com/api/v1/afip";
const WSID = "ws_sr_constancia_inscripcion";
const WSID_A13 = "ws_sr_padron_a13";

function getAfipConfig() {
  const accessToken = process.env.AFIPSDK_ACCESS_TOKEN?.trim() || "";
  const environment =
    process.env.ARCA_ENV === "prod" || process.env.ARCA_ENV === "production"
      ? "prod"
      : "dev";
  const taxId =
    digitsOnly(process.env.ARCA_CUIT_REPRESENTADA || "20409378472") ||
    "20409378472";
  const cert = process.env.ARCA_CERT?.trim() || "";
  const key = process.env.ARCA_KEY?.trim() || "";

  return { accessToken, environment, taxId, cert, key };
}

/** Hay al menos un proveedor listo (Indicadores sin cert, o Afip SDK). */
export function isArcaConfigured(): boolean {
  return isIndicadoresConfigured() || Boolean(getAfipConfig().accessToken);
}

export function getTaxLookupProviders(): {
  indicadores: boolean;
  afipsdk: boolean;
} {
  return {
    indicadores: isIndicadoresConfigured(),
    afipsdk: Boolean(getAfipConfig().accessToken),
  };
}

async function afipAuth(wsid: string): Promise<{ token: string; sign: string }> {
  const { accessToken, environment, taxId, cert, key } = getAfipConfig();

  if (environment === "prod" && (!cert || !key)) {
    throw new Error(
      "ARCA_ENV=prod requiere ARCA_CERT y ARCA_KEY. Usá ARCA_ENV=dev o Indicadores.ar.",
    );
  }

  const body: Record<string, string> = {
    environment,
    tax_id: taxId,
    wsid,
  };
  if (cert && key) {
    body.cert = cert;
    body.key = key;
  }

  const res = await fetch(`${AFIPSDK_BASE}/auth`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    if (/Certificado es obligatorio|Key es obligatorio/i.test(text)) {
      throw new Error(
        "Afip SDK pide certificado. Configurá INDICADORES_API_KEY (sin cert) o ARCA_CERT/ARCA_KEY.",
      );
    }
    throw new Error(`Auth ARCA falló (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { token?: string; sign?: string };
  if (!data.token || !data.sign) {
    throw new Error("Auth ARCA no devolvió token/sign.");
  }
  return { token: data.token, sign: data.sign };
}

async function afipRequest(
  wsid: string,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const { accessToken, environment } = getAfipConfig();
  const { token, sign } = await afipAuth(wsid);

  const res = await fetch(`${AFIPSDK_BASE}/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      environment,
      method,
      wsid,
      params: { ...params, token, sign },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Consulta ARCA falló (${res.status}): ${text.slice(0, 240)}`);
  }

  return res.json();
}

function buildAddress(domicilio: Record<string, unknown> | null | undefined): {
  address: string | null;
  state: string | null;
  postalCode: string | null;
} {
  if (!domicilio) {
    return { address: null, state: null, postalCode: null };
  }

  const direccion = String(domicilio.direccion ?? "").trim();
  const localidad = String(domicilio.localidad ?? "").trim();
  const descripcionProvincia = String(
    domicilio.descripcionProvincia ?? domicilio.provincia ?? "",
  ).trim();
  const codPostal = String(domicilio.codPostal ?? "").trim() || null;
  const parts = [direccion, localidad, descripcionProvincia].filter(Boolean);

  return {
    address: parts.length ? parts.join(", ") : null,
    state: descripcionProvincia || null,
    postalCode: codPostal,
  };
}

function mapPersonaPayload(
  raw: Record<string, unknown>,
  taxId: string,
): ArcaPersona {
  const datosGenerales =
    (raw.datosGenerales as Record<string, unknown> | undefined) ?? raw;

  const razonSocial = String(
    datosGenerales.razonSocial ?? raw.razonSocial ?? "",
  ).trim();
  const apellido = String(datosGenerales.apellido ?? raw.apellido ?? "").trim();
  const nombre = String(datosGenerales.nombre ?? raw.nombre ?? "").trim();
  const fullName = razonSocial || [apellido, nombre].filter(Boolean).join(", ");
  const tipoPersona = String(
    datosGenerales.tipoPersona ?? raw.tipoPersona ?? "",
  ).toUpperCase();

  const domicilio =
    (datosGenerales.domicilioFiscal as Record<string, unknown> | undefined) ??
    (raw.domicilioFiscal as Record<string, unknown> | undefined) ??
    (Array.isArray(datosGenerales.domicilio)
      ? (datosGenerales.domicilio[0] as Record<string, unknown>)
      : undefined) ??
    (Array.isArray(raw.domicilio)
      ? (raw.domicilio[0] as Record<string, unknown>)
      : undefined);

  const { address, state, postalCode } = buildAddress(domicilio);

  return {
    taxId: formatCuit(taxId),
    name: fullName || `CUIT ${formatCuit(taxId)}`,
    personType: tipoPersona.includes("JUR")
      ? "JURIDICA"
      : tipoPersona.includes("FIS")
        ? "FISICA"
        : "UNKNOWN",
    address,
    state,
    postalCode,
    source: "afipsdk",
  };
}

async function lookupAfipByCuit(cuit: string): Promise<ArcaLookupResult> {
  if (!getAfipConfig().accessToken) {
    return {
      ok: false,
      error: "Afip SDK no configurado.",
      code: "NOT_CONFIGURED",
    };
  }

  try {
    const { taxId: representada } = getAfipConfig();
    const data = (await afipRequest(WSID, "getPersona_v2", {
      cuitRepresentada: Number(representada),
      idPersona: Number(cuit),
    })) as Record<string, unknown>;

    const payload =
      (data.personaReturn as Record<string, unknown> | undefined) ??
      (data.getPersona_v2Return as Record<string, unknown> | undefined) ??
      data;

    const errorConstancia = payload.errorConstancia as
      | { error?: string | string[] }
      | undefined;
    if (errorConstancia?.error) {
      const msg = Array.isArray(errorConstancia.error)
        ? errorConstancia.error.join(" ")
        : String(errorConstancia.error);
      if (/no existe|no se/i.test(msg)) {
        return {
          ok: false,
          error: "No se encontró el CUIT en ARCA.",
          code: "NOT_FOUND",
        };
      }
      return { ok: false, error: msg, code: "UPSTREAM" };
    }

    return { ok: true, persona: mapPersonaPayload(payload, cuit) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al consultar ARCA.";
    if (/no existe persona|not found/i.test(message)) {
      return {
        ok: false,
        error: "CUIT no encontrado en el padrón de Afip SDK.",
        code: "NOT_FOUND",
      };
    }
    return { ok: false, error: message, code: "UPSTREAM" };
  }
}

async function lookupByCuit(cuit: string): Promise<ArcaLookupResult> {
  if (isIndicadoresConfigured()) {
    const viaIndicadores = await lookupIndicadoresByCuit(cuit);
    if (viaIndicadores.ok) return viaIndicadores;
    if (viaIndicadores.code !== "NOT_FOUND") return viaIndicadores;
    // Si no está en Indicadores, intenta Afip SDK como respaldo
  }

  if (getAfipConfig().accessToken) {
    return lookupAfipByCuit(cuit);
  }

  if (!isIndicadoresConfigured()) {
    return {
      ok: false,
      error:
        "Configurá INDICADORES_API_KEY (gratis, sin certificado) en .env — https://indicadores.ar/api-empresas",
      code: "NOT_CONFIGURED",
    };
  }

  return {
    ok: false,
    error: "No se encontró el CUIT.",
    code: "NOT_FOUND",
  };
}

async function lookupByDni(dni: string): Promise<ArcaLookupResult> {
  const candidates = cuitCandidatesFromDni(dni);
  if (candidates.length === 0) {
    return {
      ok: false,
      error: "DNI inválido para generar CUIT/CUIL.",
      code: "INVALID",
    };
  }

  const found: ArcaPersona[] = [];
  for (const cuit of candidates) {
    const result = await lookupByCuit(cuit);
    if (result.ok) found.push(result.persona);
  }

  if (found.length === 0) {
    return {
      ok: false,
      error:
        "No se encontró persona con ese DNI. Probá con el CUIT/CUIL completo.",
      code: "NOT_FOUND",
    };
  }

  if (found.length === 1) {
    return { ok: true, persona: found[0] };
  }

  return {
    ok: true,
    persona: {
      ...found[0],
      candidates: found.map((p) => ({ taxId: p.taxId, name: p.name })),
    },
  };
}

/**
 * Busca contribuyente por CUIT/CUIL/DNI.
 * Prioridad: Indicadores.ar (sin certificado) → Afip SDK (opcional).
 */
export async function lookupArcaTaxId(
  rawInput: string,
): Promise<ArcaLookupResult> {
  const normalized = normalizeTaxIdInput(rawInput);

  if (normalized.kind === "UNKNOWN" || normalized.digits.length < 7) {
    return {
      ok: false,
      error: "Ingresá un CUIT (11 dígitos) o DNI (7–8 dígitos) válido.",
      code: "INVALID",
    };
  }

  if (normalized.kind === "CUIT" && !isValidCuit(normalized.digits)) {
    return {
      ok: false,
      error: "El CUIT/CUIL no pasa la validación del dígito verificador.",
      code: "INVALID",
    };
  }

  if (!isArcaConfigured()) {
    return {
      ok: false,
      error:
        "Falta INDICADORES_API_KEY. Registrate gratis en https://indicadores.ar/api-empresas, pegá la key en .env y reiniciá.",
      code: "NOT_CONFIGURED",
    };
  }

  if (detectTaxIdKind(normalized.digits) === "DNI") {
    return lookupByDni(normalized.digits);
  }

  return lookupByCuit(normalized.digits);
}
