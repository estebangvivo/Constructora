import type { PurchaseInvoiceStatus } from "@prisma/client";
import { formatMoneyByCurrency, normalizeCurrency } from "@/config/currencies";

export const INVOICE_STATUS_LABEL: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CANCELLED: "Anulada",
};

export const INVOICE_STATUS_STYLE: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-success/15 text-success",
  CANCELLED: "bg-danger/15 text-danger",
};

export function formatPurchaseMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPurchaseTotals(
  totals: Record<string, number>,
): string {
  return formatMoneyByCurrency(totals);
}
