import { normalizeWhatsAppPhone } from "@/features/treasury/lib/share-message";

export function isWhatsAppCloudConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

function apiVersion() {
  return process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
}

/**
 * Sube un PDF y lo envía como documento por WhatsApp Cloud API.
 * Requiere WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.
 *
 * Nota Meta: fuera de la ventana de 24 h del chat, hace falta una plantilla
 * aprobada; dentro de la ventana el documento se adjunta automáticamente.
 */
export async function sendWhatsAppPdfDocument(input: {
  toPhone: string;
  pdfBytes: Uint8Array;
  filename: string;
  caption?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      error:
        "WhatsApp Business API no está configurada (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).",
    };
  }

  const to = normalizeWhatsAppPhone(input.toPhone);
  if (!to || to.length < 10) {
    return { ok: false, error: "Indicá un teléfono válido con código de área." };
  }

  const version = apiVersion();
  const auth = { Authorization: `Bearer ${token}` };

  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "application/pdf");
    form.append(
      "file",
      new Blob([Buffer.from(input.pdfBytes)], { type: "application/pdf" }),
      input.filename,
    );

    const uploadRes = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/media`,
      { method: "POST", headers: auth, body: form },
    );
    const uploadJson = (await uploadRes.json().catch(() => null)) as {
      id?: string;
      error?: { message?: string };
    } | null;

    if (!uploadRes.ok || !uploadJson?.id) {
      return {
        ok: false,
        error:
          uploadJson?.error?.message ??
          `No se pudo subir el PDF a WhatsApp (${uploadRes.status}).`,
      };
    }

    const sendRes = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "document",
          document: {
            id: uploadJson.id,
            filename: input.filename,
            ...(input.caption?.trim()
              ? { caption: input.caption.trim().slice(0, 1024) }
              : {}),
          },
        }),
      },
    );
    const sendJson = (await sendRes.json().catch(() => null)) as {
      error?: { message?: string; error_data?: { details?: string } };
      messages?: unknown[];
    } | null;

    if (!sendRes.ok) {
      const detail =
        sendJson?.error?.error_data?.details ||
        sendJson?.error?.message ||
        `WhatsApp rechazó el envío (${sendRes.status}).`;
      return { ok: false, error: detail };
    }

    return { ok: true };
  } catch (error) {
    console.error("sendWhatsAppPdfDocument", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al enviar el PDF por WhatsApp.",
    };
  }
}
