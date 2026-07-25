import type { PaymentMethod, TreasuryDocStatus } from "@prisma/client";
import { normalizeCurrency } from "@/config/currencies";

export const TREASURY_STATUS_LABEL: Record<TreasuryDocStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitido",
  POSTED: "Imputado",
  CANCELLED: "Anulado",
};

export const TREASURY_STATUS_STYLE: Record<TreasuryDocStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-accent/15 text-accent",
  POSTED: "bg-success/15 text-success",
  CANCELLED: "bg-danger/15 text-danger",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
  OTHER: "Otro",
};

export function formatMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(value);
}
