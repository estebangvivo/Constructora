import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, isEmailConfigured } from "@/lib/email";
import {
  isWhatsAppCloudConfigured,
  sendWhatsAppTextMessage,
} from "@/features/treasury/lib/whatsapp-cloud";
import { BILLING_PLANS, normalizeBillingPlanId } from "@/features/billing/lib/plans";

export type PaymentDecision = "APPROVED" | "REJECTED";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function buildMessage(input: {
  decision: PaymentDecision;
  userName: string;
  planLabel: string;
  amountLabel: string;
  companyLabel: string | null;
  reason: string | null;
}) {
  const greeting = input.userName ? `Hola ${input.userName},` : "Hola,";
  const company = input.companyLabel ? ` (${input.companyLabel})` : "";

  if (input.decision === "APPROVED") {
    const subject = `Pago aceptado — ${input.planLabel}`;
    const text = [
      greeting,
      "",
      `Tu pago fue aceptado${company}.`,
      `Plan: ${input.planLabel}`,
      `Monto: ${input.amountLabel}`,
      "",
      "Ya podés ingresar al sistema con tu cuenta.",
      `${appBaseUrl()}/billing`,
      "",
      "— SimpleObra",
    ].join("\n");
    return { subject, text };
  }

  const reason =
    input.reason?.trim() ||
    "No se indicó un motivo. Escribinos si necesitás más detalle.";
  const subject = `Pago rechazado — ${input.planLabel}`;
  const text = [
    greeting,
    "",
    `Tu pago fue rechazado${company}.`,
    `Plan: ${input.planLabel}`,
    `Monto: ${input.amountLabel}`,
    "",
    `Motivo: ${reason}`,
    "",
    "Podés corregir el comprobante o elegir otro medio de pago:",
    `${appBaseUrl()}/billing`,
    "",
    "— SimpleObra",
  ].join("\n");
  return { subject, text };
}

/**
 * Avisa al pagador por email y/o WhatsApp según lo configurado.
 * No lanza: registra errores y sigue (el flujo de admin no debe fallar).
 */
export async function notifyBillingPaymentDecision(input: {
  paymentId: string;
  decision: PaymentDecision;
  reason?: string | null;
}): Promise<{ email: boolean; whatsapp: boolean }> {
  const result = { email: false, whatsapp: false };

  try {
    const payment = await prisma.billingPayment.findUnique({
      where: { id: input.paymentId },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: { select: { name: true } },
      },
    });
    if (!payment) return result;

    const planId = normalizeBillingPlanId(payment.plan);
    const planLabel = planId
      ? BILLING_PLANS[planId].label
      : payment.plan;
    const amountLabel = `${payment.currency} ${Number(payment.amount).toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
    const userName =
      [payment.user.firstName, payment.user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || payment.user.email;
    const companyLabel =
      payment.companyName?.trim() ||
      payment.organization?.name?.trim() ||
      null;

    let reason = input.reason?.trim() || null;
    if (!reason && input.decision === "REJECTED" && payment.notes) {
      const match = payment.notes.match(/Rechazo:\s*(.+)$/m);
      reason = match?.[1]?.trim() || null;
    }

    const { subject, text } = buildMessage({
      decision: input.decision,
      userName,
      planLabel,
      amountLabel,
      companyLabel,
      reason,
    });

    if (isEmailConfigured() && payment.user.email) {
      const emailRes = await sendTransactionalEmail({
        to: payment.user.email,
        subject,
        text,
      });
      result.email = emailRes.ok;
      if (!emailRes.ok) {
        console.warn("notifyBillingPaymentDecision email", emailRes.error);
      }
    }

    if (isWhatsAppCloudConfigured() && payment.user.phone?.trim()) {
      const waRes = await sendWhatsAppTextMessage({
        toPhone: payment.user.phone,
        body: text,
      });
      result.whatsapp = waRes.ok;
      if (!waRes.ok) {
        console.warn("notifyBillingPaymentDecision whatsapp", waRes.error);
      }
    } else if (!payment.user.phone?.trim()) {
      console.warn(
        "notifyBillingPaymentDecision: usuario sin teléfono",
        payment.userId,
      );
    }
  } catch (error) {
    console.error("notifyBillingPaymentDecision", error);
  }

  return result;
}
