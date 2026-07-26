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

/** Deja solo dígitos; si parece AR sin código de país, antepone 54. */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // 15… / 11… locales → 549…
  if (digits.startsWith("15") && digits.length >= 10) {
    digits = `549${digits.slice(2)}`;
  } else if (digits.length === 10 && digits.startsWith("11")) {
    digits = `54${digits}`;
  } else if (digits.length === 10) {
    digits = `54${digits}`;
  } else if (digits.startsWith("0")) {
    digits = `54${digits.replace(/^0+/, "")}`;
  }
  return digits;
}

export function buildWhatsAppShareUrl(phone: string, text: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(text);
  if (normalized) {
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
