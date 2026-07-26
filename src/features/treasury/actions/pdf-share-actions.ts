"use server";

import { requireSession } from "@/lib/auth";
import { signPdfShareToken } from "@/features/treasury/lib/pdf-share-token";
import {
  getPaymentOrderById,
  getReceiptById,
} from "@/features/treasury/queries/list-treasury";

export async function createTreasuryPdfShareLink(input: {
  kind: "receipt" | "payment-order";
  id: string;
}): Promise<{ ok: true; urlPath: string } | { ok: false; error: string }> {
  try {
    const session = await requireSession();

    if (input.kind === "receipt") {
      const doc = await getReceiptById(input.id);
      if (!doc) return { ok: false, error: "Recibo no encontrado." };
    } else {
      const doc = await getPaymentOrderById(input.id);
      if (!doc) return { ok: false, error: "Orden de pago no encontrada." };
    }

    const token = await signPdfShareToken({
      kind: input.kind,
      id: input.id,
      organizationId: session.organizationId,
    });

    return {
      ok: true,
      urlPath: `/api/treasury/shared-pdf?token=${encodeURIComponent(token)}`,
    };
  } catch (error) {
    console.error("createTreasuryPdfShareLink", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear el enlace del PDF.",
    };
  }
}
