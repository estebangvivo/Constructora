import { formatMoney, PAYMENT_METHOD_LABEL } from "@/features/treasury/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import type { PaymentMethod } from "@prisma/client";

export type SharePaymentLine = {
  method: PaymentMethod;
  amount: number;
  checkNumber?: string | null;
  checkBank?: string | null;
  bankAccountName?: string | null;
};

export type ShareTreasuryDocInput = {
  kind: "receipt" | "payment-order";
  number: string;
  issueDate: Date | string;
  partyName: string;
  totalAmount: number;
  currency: string;
  concept?: string | null;
  organizationName?: string | null;
  payments: SharePaymentLine[];
};

export function buildTreasuryShareSubject(input: ShareTreasuryDocInput): string {
  const label = input.kind === "receipt" ? "Recibo" : "Orden de pago";
  return `${label} ${input.number}`;
}

export function buildTreasuryShareMessage(input: ShareTreasuryDocInput): string {
  const label = input.kind === "receipt" ? "Recibo" : "Orden de pago";
  const partyLabel = input.kind === "receipt" ? "Cliente" : "Beneficiario";
  const lines: string[] = [];

  if (input.organizationName?.trim()) {
    lines.push(input.organizationName.trim());
    lines.push("");
  }

  lines.push(`${label} ${input.number}`);
  lines.push(`Fecha: ${formatDateAR(input.issueDate)}`);
  lines.push(`${partyLabel}: ${input.partyName}`);
  lines.push(`Total: ${formatMoney(input.totalAmount, input.currency)}`);

  if (input.concept?.trim()) {
    lines.push(`Concepto: ${input.concept.trim()}`);
  }

  if (input.payments.length > 0) {
    lines.push("");
    lines.push("Medios de pago:");
    for (const p of input.payments) {
      const parts = [
        PAYMENT_METHOD_LABEL[p.method],
        formatMoney(p.amount, input.currency),
      ];
      if (p.method === "CHECK" && (p.checkNumber || p.checkBank)) {
        parts.push([p.checkNumber, p.checkBank].filter(Boolean).join(" · "));
      }
      if (p.method === "TRANSFER" && p.bankAccountName) {
        parts.push(p.bankAccountName);
      }
      lines.push(`· ${parts.join(" · ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Deja solo dígitos en formato internacional para wa.me.
 * Argentina móvil: 54 9 + área + número (ej. 11 5555-5555 → 5491155555555).
 */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Quitar 00 internacional
  if (digits.startsWith("00")) digits = digits.slice(2);

  // 549… ya ok (móvil AR)
  if (digits.startsWith("549") && digits.length >= 12) {
    return digits;
  }

  // 54 + área sin el 9 (ej. 5411…) → insertar 9
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length >= 12) {
    return `549${digits.slice(2)}`;
  }

  // 15… local viejo → 549…
  if (digits.startsWith("15") && digits.length >= 10) {
    return `549${digits.slice(2)}`;
  }

  // 0 + área (011…) → 549…
  if (digits.startsWith("0") && digits.length >= 10) {
    return `549${digits.replace(/^0+/, "")}`;
  }

  // 10 dígitos (11…) → 549…
  if (digits.length === 10) {
    return `549${digits}`;
  }

  // 11 dígitos empezando con 9 (9 11 …) → 54…
  if (digits.length === 11 && digits.startsWith("9")) {
    return `54${digits}`;
  }

  // Otros países / ya internacionales
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return "";
}

/** true si el número normalizado es usable en wa.me */
export function isValidWhatsAppPhone(raw: string): boolean {
  const n = normalizeWhatsAppPhone(raw);
  return n.length >= 10 && n.length <= 15;
}

export function buildWhatsAppShareUrl(phone: string, text: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(text);
  if (normalized && isValidWhatsAppPhone(normalized)) {
    return `https://wa.me/${normalized}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function buildMailtoShareUrl(
  email: string,
  subject: string,
  body: string,
): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  const to = email.trim();
  return `mailto:${to}?${params.toString()}`;
}
