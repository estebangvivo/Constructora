import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateBillingPayment } from "@/features/billing/lib/activate";
import {
  fetchMercadoPagoPayment,
} from "@/features/billing/lib/mercadopago";
import { isMercadoPagoConfigured } from "@/features/billing/lib/platform-billing-settings";

export const dynamic = "force-dynamic";

async function handleApprovedExternalReference(
  externalReference: string,
  mpPaymentId: string,
) {
  const payment = await prisma.billingPayment.findUnique({
    where: { id: externalReference },
  });
  if (!payment) {
    console.warn("MP webhook: payment not found", externalReference);
    return;
  }
  if (payment.status === "APPROVED") return;
  await activateBillingPayment(payment.id, { mpPaymentId });
}

export async function POST(request: NextRequest) {
  if (!(await isMercadoPagoConfigured())) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  try {
    const url = request.nextUrl;
    const topic =
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      "";
    const dataId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      "";

    let body: {
      type?: string;
      action?: string;
      data?: { id?: string };
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // query-only notifications
    }

    const type = body.type || topic;
    const id = body.data?.id || dataId;

    if ((type === "payment" || topic === "payment") && id) {
      const mpPayment = await fetchMercadoPagoPayment(String(id));
      if (
        mpPayment.status === "approved" &&
        mpPayment.external_reference
      ) {
        await handleApprovedExternalReference(
          mpPayment.external_reference,
          String(mpPayment.id),
        );
      }
    }

    // Preapproval / subscription authorized
    if (
      (type === "subscription_preapproval" ||
        type === "subscription_authorized_payment" ||
        topic === "preapproval") &&
      id
    ) {
      // Buscar pago por mpPreapprovalId
      const payment = await prisma.billingPayment.findFirst({
        where: {
          OR: [{ mpPreapprovalId: String(id) }, { mpPreferenceId: String(id) }],
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });
      if (payment) {
        await activateBillingPayment(payment.id, {
          mpPaymentId: String(id),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("MP webhook", error);
    return NextResponse.json({ ok: true }); // MP reintenta si no-2xx; logueamos y ack
  }
}

export async function GET(request: NextRequest) {
  // MP a veces hace GET de prueba
  return POST(request);
}
