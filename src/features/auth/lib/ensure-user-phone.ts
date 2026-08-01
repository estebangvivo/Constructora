import { prisma } from "@/lib/prisma";
import { isValidWhatsAppPhone } from "@/features/treasury/lib/share-message";

/** Guarda o valida el celular del usuario (requerido para avisos de pago). */
export async function ensureUserPhone(
  userId: string,
  phoneInput?: string | null,
): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  const current = existing?.phone?.trim() || "";
  const incoming = phoneInput?.trim() || "";

  if (incoming) {
    if (!isValidWhatsAppPhone(incoming)) {
      return {
        ok: false,
        error:
          "Teléfono inválido. Usá código de área (ej. 11 5555-5555 o +54 9 11 …).",
      };
    }
    if (incoming !== current) {
      await prisma.user.update({
        where: { id: userId },
        data: { phone: incoming },
      });
    }
    return { ok: true, phone: incoming };
  }

  if (current && isValidWhatsAppPhone(current)) {
    return { ok: true, phone: current };
  }

  return {
    ok: false,
    error: "Indicá tu teléfono celular para avisarte el resultado del pago.",
  };
}
