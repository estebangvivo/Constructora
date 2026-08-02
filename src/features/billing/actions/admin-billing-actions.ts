"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthSession } from "@/lib/auth";
import { activateBillingPayment } from "@/features/billing/lib/activate";
import {
  setLocalSessionCookie,
  signLocalSession,
} from "@/features/auth/lib/session";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { getBillingUsdArsRate } from "@/features/billing/lib/fx";

function assertPlatformBillingAdmin(email: string) {
  if (!isPlatformSuperadmin({ user: { email } })) {
    throw new Error("FORBIDDEN");
  }
}

function mapPaymentRow(
  p: {
    id: string;
    plan: string;
    method: string;
    currency: string;
    amount: { toString(): string } | number;
    fxRateUsed: { toString(): string } | number | null;
    companyName: string | null;
    companySlug: string | null;
    organizationId: string | null;
    transferProofUrl: string | null;
    notes: string | null;
    status: string;
    mpPaymentId: string | null;
    mpPreferenceId: string | null;
    createdAt: Date;
    user: {
      email: string;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
    };
    organization: { id: string; name: string } | null;
  },
  fallbackUsdArsRate: number | null,
) {
  const amount = Number(p.amount);
  const fxRateUsed = p.fxRateUsed ? Number(p.fxRateUsed) : null;
  const currency = (p.currency || "USD").toUpperCase();
  const rate = fxRateUsed && fxRateUsed > 0 ? fxRateUsed : fallbackUsdArsRate;

  let amountUsd: number | null = null;
  let amountArs: number | null = null;
  if (currency === "ARS") {
    amountArs = amount;
    amountUsd =
      rate && rate > 0 ? Math.round((amount / rate) * 100) / 100 : null;
  } else {
    amountUsd = amount;
    amountArs =
      rate && rate > 0 ? Math.round(amount * rate * 100) / 100 : null;
  }

  return {
    id: p.id,
    plan: p.plan,
    method: p.method,
    currency,
    amount,
    amountUsd,
    amountArs,
    fxRateUsed,
    companyName: p.companyName,
    companySlug: p.companySlug,
    organizationId: p.organizationId,
    organizationName: p.organization?.name ?? null,
    transferProofUrl: p.transferProofUrl,
    notes: p.notes,
    status: p.status,
    mpPaymentId: p.mpPaymentId,
    mpPreferenceId: p.mpPreferenceId,
    createdAt: p.createdAt.toISOString(),
    userEmail: p.user.email,
    userPhone: p.user.phone,
    userName:
      [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") ||
      p.user.email,
  };
}

const paymentInclude = {
  user: {
    select: { email: true, phone: true, firstName: true, lastName: true },
  },
  organization: { select: { id: true, name: true } },
} as const;

/** @deprecated UsÃ¡ listAdminBillingPayments. */
export async function listPendingBillingPayments() {
  const data = await listAdminBillingPayments();
  return data.pendingTransfers;
}

/** Transferencias pendientes + historial reciente (MP y transferencias). */
export async function listAdminBillingPayments(): Promise<{
  pendingTransfers: ReturnType<typeof mapPaymentRow>[];
  recent: ReturnType<typeof mapPaymentRow>[];
}> {
  const empty = { pendingTransfers: [], recent: [] };
  const session = await requireAuthSession();
  try {
    assertPlatformBillingAdmin(session.user.email);
  } catch {
    return empty;
  }

  const [pending, recent, usdArsRate] = await Promise.all([
    prisma.billingPayment.findMany({
      where: { status: "PENDING", method: "TRANSFER" },
      include: paymentInclude,
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.billingPayment.findMany({
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    getBillingUsdArsRate(),
  ]);

  return {
    pendingTransfers: pending.map((p) => mapPaymentRow(p, usdArsRate)),
    recent: recent.map((p) => mapPaymentRow(p, usdArsRate)),
  };
}

export type BillingReviewResult =
  | {
      ok: true;
      notifiedEmail: boolean;
      notifiedWhatsapp: boolean;
      notifyWarning?: string;
    }
  | { ok: false; error: string };

function notifyWarning(notified: {
  email: boolean;
  whatsapp: boolean;
}): string | undefined {
  if (notified.email || notified.whatsapp) return undefined;
  return (
    "El pago se registrÃ³, pero no se enviÃ³ aviso: configurÃ¡ WhatsApp " +
    "(WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID) y/o email " +
    "(RESEND_API_KEY + EMAIL_FROM) en el .env del servidor."
  );
}

export async function approveBillingPayment(
  paymentId: string,
): Promise<BillingReviewResult> {
  try {
    const session = await requireAuthSession();
    assertPlatformBillingAdmin(session.user.email);

    const updated = await activateBillingPayment(paymentId, {
      approvedById: session.user.id,
    });

    // Si el aprobador no es el pagador, no tocamos su cookie.
    // Si el pagador estÃ¡ logueado en otro lado, al refrescar verÃ¡ la org.
    if (updated.organizationId && updated.userId === session.user.id) {
      const token = await signLocalSession({
        userId: session.user.id,
        organizationId: updated.organizationId,
      });
      await setLocalSessionCookie(token);
    }

    revalidatePath("/admin");
    revalidatePath("/billing");
    revalidatePath("/onboarding/pago");
    revalidatePath("/", "layout");
    const { isWhatsAppCloudConfigured } = await import(
      "@/features/treasury/lib/whatsapp-cloud"
    );
    const { isEmailConfigured } = await import("@/lib/email");
    const channels = {
      email: isEmailConfigured(),
      whatsapp: isWhatsAppCloudConfigured(),
    };
    return {
      ok: true,
      notifiedEmail: channels.email,
      notifiedWhatsapp: channels.whatsapp,
      notifyWarning: notifyWarning(channels),
    };
  } catch (error) {
    console.error("approveBillingPayment", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo aprobar el pago.",
    };
  }
}

export async function rejectBillingPayment(
  paymentId: string,
  reason?: string,
): Promise<BillingReviewResult> {
  try {
    const session = await requireAuthSession();
    assertPlatformBillingAdmin(session.user.email);

    const payment = await prisma.billingPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status !== "PENDING") {
      return { ok: false, error: "Pago no pendiente." };
    }

    const trimmedReason = reason?.trim() || "";
    if (!trimmedReason) {
      return {
        ok: false,
        error: "IndicÃ¡ el motivo del rechazo (se le enviarÃ¡ al usuario).",
      };
    }

    await prisma.billingPayment.update({
      where: { id: paymentId },
      data: {
        status: "REJECTED",
        approvedById: session.user.id,
        notes: [payment.notes, `Rechazo: ${trimmedReason}`]
          .filter(Boolean)
          .join("\n"),
      },
    });

    if (payment.organizationId) {
      await prisma.organization.update({
        where: { id: payment.organizationId },
        data: { billingStatus: "PAST_DUE" },
      });
    }

    const { notifyBillingPaymentDecision } = await import(
      "@/features/billing/lib/notify-payment-decision"
    );
    // await: en Server Actions un void se corta al devolver la respuesta
    const notified = await notifyBillingPaymentDecision({
      paymentId,
      decision: "REJECTED",
      reason: trimmedReason,
    });
    if (!notified.whatsapp && !notified.email) {
      console.warn(
        "rejectBillingPayment: pago rechazado pero no se pudo notificar (WhatsApp/email)",
        { paymentId, ...notified },
      );
    }

    revalidatePath("/admin");
    revalidatePath("/billing");
    return {
      ok: true,
      notifiedEmail: notified.email,
      notifiedWhatsapp: notified.whatsapp,
      notifyWarning: notifyWarning(notified),
    };
  } catch (error) {
    console.error("rejectBillingPayment", error);
    return { ok: false, error: "No se pudo rechazar el pago." };
  }
}
