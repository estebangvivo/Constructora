import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, isEmailConfigured } from "@/lib/email";
import {
  isWhatsAppCloudConfigured,
  sendWhatsAppTextMessage,
} from "@/features/treasury/lib/whatsapp-cloud";
import { formatMoney } from "@/features/treasury/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import type { ChecksDueAlert } from "@/features/treasury/queries/list-checks";

const ALERT_TYPE = "CHECK_DUE_EXTERNAL";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function buildCheckAlertMessage(alert: ChecksDueAlert, orgName: string) {
  const lines: string[] = [
    `Alerta de cheques — ${orgName}`,
    "",
  ];
  if (alert.overdue.length > 0) {
    lines.push(`${alert.overdue.length} vencido(s):`);
    for (const c of alert.overdue.slice(0, 5)) {
      lines.push(
        `· ${c.number} · ${formatMoney(c.amount, c.currency)} · vto ${formatDateAR(c.dueDate)}`,
      );
    }
    lines.push("");
  }
  if (alert.dueSoon.length > 0) {
    lines.push(`${alert.dueSoon.length} por vencer:`);
    for (const c of alert.dueSoon.slice(0, 5)) {
      lines.push(
        `· ${c.number} · ${formatMoney(c.amount, c.currency)} · vto ${formatDateAR(c.dueDate)}`,
      );
    }
    lines.push("");
  }
  lines.push(`Ver detalle: ${appBaseUrl()}/treasury/checks`);
  lines.push("");
  lines.push("— SimpleObra");
  return lines.join("\n");
}

export type DispatchCheckAlertsResult = {
  skipped: boolean;
  reason?: string;
  email: boolean;
  whatsapp: boolean;
  notifiedUsers: number;
};

/**
 * Envía alerta de cheques por email y/o WhatsApp a admins/directores.
 * Deduplica 1 envío externo por organización y día (salvo force).
 */
export async function dispatchCheckDueExternalAlerts(input: {
  organizationId: string;
  alert: ChecksDueAlert;
  force?: boolean;
}): Promise<DispatchCheckAlertsResult> {
  const result: DispatchCheckAlertsResult = {
    skipped: false,
    email: false,
    whatsapp: false,
    notifiedUsers: 0,
  };

  if (input.alert.total === 0) {
    return { ...result, skipped: true, reason: "Sin cheques en alerta." };
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      whatsapp: true,
    },
  });
  if (!org) {
    return { ...result, skipped: true, reason: "Organización no encontrada." };
  }

  const today = dayKey();
  if (!input.force) {
    const already = await prisma.appNotification.findFirst({
      where: {
        organizationId: org.id,
        type: ALERT_TYPE,
        title: { startsWith: `checks:${today}` },
        createdAt: { gte: new Date(`${today}T00:00:00.000Z`) },
      },
      select: { id: true },
    });
    if (already) {
      return {
        ...result,
        skipped: true,
        reason: "Ya se envió la alerta de cheques hoy.",
      };
    }
  }

  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: org.id,
      role: { in: ["ADMIN", "DIRECTOR"] },
    },
    include: {
      user: { select: { id: true, email: true, phone: true, firstName: true } },
    },
  });

  const body = buildCheckAlertMessage(input.alert, org.name);
  const subject = `Cheques: ${input.alert.overdue.length} vencidos · ${input.alert.dueSoon.length} por vencer`;

  const emailTargets = new Set<string>();
  if (org.email?.includes("@")) emailTargets.add(org.email.trim().toLowerCase());
  for (const m of members) {
    if (m.user.email?.includes("@")) {
      emailTargets.add(m.user.email.trim().toLowerCase());
    }
  }

  const waTargets = new Set<string>();
  if (org.whatsapp?.trim()) waTargets.add(org.whatsapp.trim());
  for (const m of members) {
    if (m.user.phone?.trim()) waTargets.add(m.user.phone.trim());
  }

  if (isEmailConfigured()) {
    for (const to of emailTargets) {
      const sent = await sendTransactionalEmail({
        to,
        subject,
        text: body,
      });
      if (sent.ok) result.email = true;
    }
  }

  if (isWhatsAppCloudConfigured()) {
    for (const phone of waTargets) {
      const sent = await sendWhatsAppTextMessage({
        toPhone: phone,
        body,
      });
      if (sent.ok) result.whatsapp = true;
    }
  }

  // Notificación in-app + marca anti-spam del día
  for (const m of members) {
    await prisma.appNotification.create({
      data: {
        organizationId: org.id,
        userId: m.userId,
        type: ALERT_TYPE,
        title: `checks:${today} · ${subject}`,
        body: body.slice(0, 500),
        href: "/treasury/checks",
      },
    });
    result.notifiedUsers += 1;
  }

  if (!result.email && !result.whatsapp && result.notifiedUsers === 0) {
    return {
      ...result,
      skipped: true,
      reason:
        "No hay destinatarios ni canales configurados (email/WhatsApp).",
    };
  }

  return result;
}
