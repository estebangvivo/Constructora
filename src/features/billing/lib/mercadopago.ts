import {
  BILLING_PLANS,
  planIsMonthlyCycle,
  type BillingPlanId,
} from "@/features/billing/lib/plans";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoAccessToken,
  isMercadoPagoConfigured,
} from "@/features/billing/lib/platform-billing-settings";

type CheckoutResult = {
  preferenceId: string;
  initPoint: string;
  preapprovalId?: string;
};

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function mpToken() {
  const token = await getMercadoPagoAccessToken();
  if (!token) {
    throw new Error(
      "Mercado Pago no está configurado. Cargá el Access Token en Administración.",
    );
  }
  return token;
}

/**
 * Checkout MP:
 * - TRIAL / precio ARS → Preference one-shot en ARS
 * - ciclo anual → Preference one-shot USD
 * - ciclo mensual → Preapproval (suscripción) si hay auto_recurring; fallback preference
 */
export async function createMercadoPagoCheckout(input: {
  paymentId: string;
  plan: BillingPlanId;
  title: string;
  payerEmail: string;
  successUrl?: string;
  failureUrl?: string;
}): Promise<CheckoutResult> {
  if (!(await isMercadoPagoConfigured())) {
    throw new Error(
      "Mercado Pago no está configurado. Usá transferencia o configurá el Access Token en Administración.",
    );
  }

  const token = await mpToken();
  const base = appBaseUrl();
  const payment = await prisma.billingPayment.findUnique({
    where: { id: input.paymentId },
    select: { amount: true, currency: true },
  });
  if (!payment) {
    throw new Error("Pago no encontrado para checkout Mercado Pago.");
  }
  const charge = {
    currency: (payment.currency === "ARS" ? "ARS" : "USD") as "USD" | "ARS",
    amount: Number(payment.amount),
  };
  if (!Number.isFinite(charge.amount) || charge.amount < 0) {
    throw new Error("Monto de pago inválido para Mercado Pago.");
  }
  const plan = BILLING_PLANS[input.plan];
  const successUrl = input.successUrl ?? `${base}/billing?mp=success`;
  const failureUrl = input.failureUrl ?? `${base}/onboarding/pago?mp=failure`;

  const useSubscription =
    charge.currency === "USD" &&
    planIsMonthlyCycle(input.plan) &&
    !plan.isTrial;

  if (useSubscription) {
    const body = {
      reason: input.title,
      external_reference: input.paymentId,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: charge.amount,
        currency_id: charge.currency,
      },
      back_url: successUrl,
      status: "pending",
    };

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        id?: string;
        init_point?: string;
        sandbox_init_point?: string;
      };
      const initPoint = data.init_point || data.sandbox_init_point;
      if (data.id && initPoint) {
        return {
          preferenceId: data.id,
          preapprovalId: data.id,
          initPoint,
        };
      }
    } else {
      const errText = await res.text();
      console.warn("MP preapproval failed, fallback preference", errText);
    }
  }

  const prefBody = {
    items: [
      {
        id: input.plan,
        title: input.title,
        description: plan.description,
        quantity: 1,
        currency_id: charge.currency,
        unit_price: charge.amount,
      },
    ],
    external_reference: input.paymentId,
    payer: { email: input.payerEmail },
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: successUrl,
    },
    auto_return: "approved",
    notification_url: `${base}/api/billing/mercadopago/webhook`,
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("MP preference error", errText);
    throw new Error("Mercado Pago rechazó la preferencia de pago.");
  }

  const data = (await res.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  const initPoint = data.init_point || data.sandbox_init_point;
  if (!data.id || !initPoint) {
    throw new Error("Respuesta inválida de Mercado Pago.");
  }

  return { preferenceId: data.id, initPoint };
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  const token = await mpToken();
  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`MP payment ${paymentId}: ${res.status}`);
  }
  return res.json() as Promise<{
    id: number;
    status: string;
    external_reference?: string;
  }>;
}
