import { NextResponse } from "next/server";
import {
  getTaxLookupProviders,
  lookupArcaTaxId,
} from "@/lib/arca/lookup";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/tax-lookup?q=20111111112
 * Busca CUIT/DNI vía Indicadores.ar (sin cert) o Afip SDK.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json(
      {
        error: "Parámetro q requerido (CUIT o DNI)",
        providers: getTaxLookupProviders(),
      },
      { status: 400 },
    );
  }

  const result = await lookupArcaTaxId(q);
  if (!result.ok) {
    const status =
      result.code === "NOT_CONFIGURED"
        ? 503
        : result.code === "NOT_FOUND"
          ? 404
          : result.code === "INVALID"
            ? 400
            : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    taxId?: string;
  } | null;

  const taxId = body?.taxId?.trim() || "";
  if (!taxId) {
    return NextResponse.json(
      { error: "Body { taxId } requerido" },
      { status: 400 },
    );
  }

  const result = await lookupArcaTaxId(taxId);
  if (!result.ok) {
    const status =
      result.code === "NOT_CONFIGURED"
        ? 503
        : result.code === "NOT_FOUND"
          ? 404
          : result.code === "INVALID"
            ? 400
            : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
