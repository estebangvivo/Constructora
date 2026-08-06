"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getChecksDueAlert } from "@/features/treasury/queries/list-checks";
import { dispatchCheckDueExternalAlerts } from "@/features/alerts/lib/dispatch-check-alerts";

export type SendCheckAlertsResult =
  | { ok: true; email: boolean; whatsapp: boolean; notifiedUsers: number; skipped?: boolean; reason?: string }
  | { ok: false; error: string };

/** Envía ahora la alerta de cheques por email/WhatsApp (admins/directores). */
export async function sendCheckDueAlertsNow(
  force = true,
): Promise<SendCheckAlertsResult> {
  const session = await requireSession();
  if (!["ADMIN", "DIRECTOR"].includes(session.organizationRole)) {
    return { ok: false, error: "Solo admin o director pueden enviar alertas." };
  }

  try {
    const alert = await getChecksDueAlert();
    const result = await dispatchCheckDueExternalAlerts({
      organizationId: session.organizationId,
      alert,
      force,
    });
    revalidatePath("/treasury/checks");
    revalidatePath("/");
    return {
      ok: true,
      email: result.email,
      whatsapp: result.whatsapp,
      notifiedUsers: result.notifiedUsers,
      skipped: result.skipped,
      reason: result.reason,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo enviar la alerta.",
    };
  }
}
