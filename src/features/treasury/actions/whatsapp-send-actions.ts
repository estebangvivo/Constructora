"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  buildPaymentOrderPdfResponse,
  buildReceiptPdfResponse,
} from "@/features/treasury/lib/build-treasury-pdf-response";
import {
  isWhatsAppCloudConfigured,
  sendWhatsAppPdfDocument,
} from "@/features/treasury/lib/whatsapp-cloud";
import { treasuryPdfFilename } from "@/features/treasury/lib/treasury-pdf";
import { getReceiptById, getPaymentOrderById } from "@/features/treasury/queries/list-treasury";

export type SendWhatsAppResult =
  | { ok: true }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

export async function whatsappCloudAvailable(): Promise<boolean> {
  await requireSession();
  return isWhatsAppCloudConfigured();
}

/**
 * Genera el PDF del recibo/OP y lo envía adjunto por WhatsApp Cloud API.
 */
export async function sendTreasuryPdfViaWhatsApp(input: {
  kind: "receipt" | "payment-order";
  id: string;
  phone: string;
}): Promise<SendWhatsAppResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }
    if (!isWhatsAppCloudConfigured()) {
      return {
        ok: false,
        error:
          "Falta configurar WhatsApp Business API en el servidor para adjuntar el PDF automáticamente.",
      };
    }

    const phone = input.phone.trim();
    if (!phone) {
      return { ok: false, error: "Indicá el teléfono de destino." };
    }

    let number = "doc";
    let caption = "";
    let pdfResponse: Response;

    if (input.kind === "receipt") {
      const doc = await getReceiptById(input.id);
      if (!doc) return { ok: false, error: "Recibo no encontrado." };
      number = doc.number;
      caption = `Recibo ${doc.number}`;
      pdfResponse = await buildReceiptPdfResponse(input.id);
    } else {
      const doc = await getPaymentOrderById(input.id);
      if (!doc) return { ok: false, error: "Orden de pago no encontrada." };
      number = doc.number;
      caption = `Orden de pago ${doc.number}`;
      pdfResponse = await buildPaymentOrderPdfResponse(input.id);
    }

    if (!pdfResponse.ok) {
      return { ok: false, error: "No se pudo generar el PDF." };
    }

    const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const filename = treasuryPdfFilename(input.kind, number);

    const result = await sendWhatsAppPdfDocument({
      toPhone: phone,
      pdfBytes: bytes,
      filename,
      caption,
    });

    if (result.ok) {
      revalidatePath(
        input.kind === "receipt"
          ? `/treasury/receipts/${input.id}`
          : `/treasury/payment-orders/${input.id}`,
      );
    }
    return result;
  } catch (error) {
    console.error("sendTreasuryPdfViaWhatsApp", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo enviar el PDF por WhatsApp.",
    };
  }
}
