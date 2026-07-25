import type {
  CheckStatus,
  PaymentMethod,
  TreasuryDocStatus,
} from "@prisma/client";
import { normalizeCurrency } from "@/config/currencies";

export const TREASURY_STATUS_LABEL: Record<TreasuryDocStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitido",
  POSTED: "Imputado",
  CANCELLED: "Anulado",
};

export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  IN_PORTFOLIO: "En cartera",
  DELIVERED: "Entregado",
  CANCELLED: "Anulado",
};

export const CHECK_STATUS_STYLE: Record<CheckStatus, string> = {
  IN_PORTFOLIO: "border border-border bg-background text-foreground",
  DELIVERED: "border border-border bg-muted text-muted-foreground",
  CANCELLED: "border border-border bg-muted text-muted-foreground",
};

export const TREASURY_STATUS_STYLE: Record<TreasuryDocStatus, string> = {
  DRAFT: "border border-border bg-muted text-foreground",
  ISSUED: "border border-border bg-background text-foreground",
  POSTED: "border border-border bg-background text-foreground",
  CANCELLED: "border border-border bg-muted text-foreground",
};

export const BANK_MOVEMENT_LABEL: Record<
  import("@prisma/client").BankMovementType,
  string
> = {
  OPENING: "Saldo inicial",
  INCOME: "Ingreso",
  EXPENSE: "Egreso",
  ADJUSTMENT: "Ajuste",
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
