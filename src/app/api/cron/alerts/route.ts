import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchCheckDueExternalAlerts } from "@/features/alerts/lib/dispatch-check-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cron de alertas operativas (cheques).
 * Auth: header `Authorization: Bearer $CRON_SECRET` o `?secret=`.
 *
 * Ejemplo (Railway / cron externo):
 * GET /api/cron/alerts
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET no configurado." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret") ?? "";
  if (bearer !== secret && q !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    where: { billingStatus: { in: ["ACTIVE", "EXEMPT", "PAST_DUE"] } },
    select: { id: true, name: true, checkDueAlertDays: true },
    take: 200,
  });

  const results: Array<{
    organizationId: string;
    name: string;
    skipped?: boolean;
    reason?: string;
    email?: boolean;
    whatsapp?: boolean;
  }> = [];

  for (const org of orgs) {
    // Reutilizamos la lógica de alerta sin sesión: calculamos inline
    const { getChecksDueAlertForOrganization } = await import(
      "@/features/alerts/lib/checks-due-for-org"
    );
    const alert = await getChecksDueAlertForOrganization(org.id);
    const dispatched = await dispatchCheckDueExternalAlerts({
      organizationId: org.id,
      alert,
      force: false,
    });
    results.push({
      organizationId: org.id,
      name: org.name,
      skipped: dispatched.skipped,
      reason: dispatched.reason,
      email: dispatched.email,
      whatsapp: dispatched.whatsapp,
    });
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
