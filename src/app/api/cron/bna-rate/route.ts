import { NextResponse } from "next/server";
import { syncBnaUsdRateForAllOrgs } from "@/features/settings/lib/sync-bna-rate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // En desarrollo sin secret, permitir solo localhost
    if (process.env.AUTH_DEV_BYPASS === "true") return true;
    return false;
  }
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : null;
  const query = new URL(request.url).searchParams.get("secret");
  return bearer === secret || query === secret;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await syncBnaUsdRateForAllOrgs();
    return NextResponse.json({
      ok: true,
      count: results.length,
      results: results.map((r) => ({
        organization: r.organizationName,
        rate: r.rate,
        buy: r.buy,
        sell: r.sell,
        effectiveAt: r.effectiveAt,
        created: r.created,
        updated: r.updated,
        source: r.source,
      })),
    });
  } catch (error) {
    console.error("cron/bna-rate", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al sincronizar BNA",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
