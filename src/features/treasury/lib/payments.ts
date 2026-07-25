import type { PaymentMethod } from "@prisma/client";
import { PAYMENT_METHOD_LABEL, formatMoney } from "@/features/treasury/lib/labels";

export type TreasuryPaymentInput = {
  method: PaymentMethod;
  amount: number;
  /** Obligatorio cuando method = TRANSFER. */
  bankAccountId?: string;
  /** Obligatorio en OP cuando method = CHECK (cheque de cartera). */
  checkInstrumentId?: string;
  checkNumber?: string;
  checkBank?: string;
  checkIssueDate?: string;
  checkDueDate?: string;
  checkAccount?: string;
};

export type TreasuryPaymentView = {
  id: string;
  method: PaymentMethod;
  amount: number;
  bankAccountId: string | null;
  checkNumber: string | null;
  checkBank: string | null;
  checkIssueDate: Date | null;
  checkDueDate: Date | null;
  checkAccount: string | null;
  sortOrder: number;
};

/** Suma de montos en efectivo (impactan caja diaria). */
export function cashAmountFromPayments(
  payments: { method: PaymentMethod; amount: number }[],
): number {
  return payments
    .filter((p) => p.method === "CASH")
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

/** Etiqueta corta para listados: "Efectivo" o "Efectivo + Transferencia". */
export function formatPaymentMethodsShort(
  payments: { method: PaymentMethod }[] | undefined,
  fallback: PaymentMethod,
): string {
  const methods = [
    ...new Set(
      (payments && payments.length > 0
        ? payments.map((p) => p.method)
        : [fallback]
      ).filter(Boolean),
    ),
  ];
  return methods.map((m) => PAYMENT_METHOD_LABEL[m]).join(" + ");
}

/** Detalle con montos: "Efectivo $ 1.000 · Transferencia $ 500". */
export function formatPaymentMethodsDetailed(
  payments:
    | {
        method: PaymentMethod;
        amount: number;
        bankAccountName?: string | null;
      }[]
    | undefined,
  fallback: PaymentMethod,
  totalAmount: number,
  currency: string,
): string {
  if (!payments || payments.length === 0) {
    return `${PAYMENT_METHOD_LABEL[fallback]} ${formatMoney(totalAmount, currency)}`;
  }
  return payments
    .map((p) => {
      const bank =
        p.method === "TRANSFER" && p.bankAccountName
          ? ` (${p.bankAccountName})`
          : "";
      return `${PAYMENT_METHOD_LABEL[p.method]}${bank} ${formatMoney(Number(p.amount), currency)}`;
    })
    .join(" · ");
}

export function validatePaymentsAgainstTotal(
  payments: TreasuryPaymentInput[],
  totalAmount: number,
  opts?: { requirePortfolioChecks?: boolean },
): string | null {
  const cleaned = payments.filter((p) => Number(p.amount) > 0);
  if (cleaned.length === 0) {
    return "Agregá al menos un medio de pago con monto.";
  }
  for (const p of cleaned) {
    if (p.method === "TRANSFER" && !p.bankAccountId) {
      return "Elegí la cuenta bancaria en cada pago por transferencia.";
    }
    if (p.method === "CHECK") {
      if (opts?.requirePortfolioChecks) {
        if (!p.checkInstrumentId) {
          return "Elegí un cheque de la cartera para cada pago con cheque.";
        }
      } else if (!p.checkNumber?.trim() || !p.checkBank?.trim()) {
        return "Completá número y banco en cada pago con cheque.";
      }
    }
  }
  const sum = cleaned.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  if (Math.abs(sum - totalAmount) > 0.009) {
    return `La suma de medios de pago (${sum.toFixed(2)}) debe coincidir con el total del documento (${totalAmount.toFixed(2)}).`;
  }
  return null;
}

export function primaryPaymentMethod(
  payments: { method: PaymentMethod }[],
  fallback: PaymentMethod = "CASH",
): PaymentMethod {
  return payments[0]?.method ?? fallback;
}

export function paymentCreateData(
  payments: TreasuryPaymentInput[],
  opts?: { forPaymentOrder?: boolean },
) {
  return payments
    .filter((p) => Number(p.amount) > 0)
    .map((p, index) => {
      const bankAccountId =
        p.method === "TRANSFER" ? p.bankAccountId || null : null;

      if (p.method === "CHECK") {
        if (opts?.forPaymentOrder) {
          return {
            method: p.method,
            amount: Number(p.amount),
            sortOrder: index,
            bankAccountId,
            checkInstrumentId: p.checkInstrumentId || null,
            checkNumber: p.checkNumber?.trim() || null,
            checkBank: p.checkBank?.trim() || null,
            checkIssueDate: p.checkIssueDate
              ? new Date(p.checkIssueDate)
              : null,
            checkDueDate: p.checkDueDate ? new Date(p.checkDueDate) : null,
            checkAccount: p.checkAccount?.trim() || null,
          };
        }
        return {
          method: p.method,
          amount: Number(p.amount),
          sortOrder: index,
          bankAccountId,
          checkNumber: p.checkNumber?.trim() || null,
          checkBank: p.checkBank?.trim() || null,
          checkIssueDate: p.checkIssueDate
            ? new Date(p.checkIssueDate)
            : null,
          checkDueDate: p.checkDueDate ? new Date(p.checkDueDate) : null,
          checkAccount: p.checkAccount?.trim() || null,
        };
      }

      if (opts?.forPaymentOrder) {
        return {
          method: p.method,
          amount: Number(p.amount),
          sortOrder: index,
          bankAccountId,
          checkInstrumentId: null as string | null,
          checkNumber: null as string | null,
          checkBank: null as string | null,
          checkIssueDate: null as Date | null,
          checkDueDate: null as Date | null,
          checkAccount: null as string | null,
        };
      }

      return {
        method: p.method,
        amount: Number(p.amount),
        sortOrder: index,
        bankAccountId,
        checkNumber: null as string | null,
        checkBank: null as string | null,
        checkIssueDate: null as Date | null,
        checkDueDate: null as Date | null,
        checkAccount: null as string | null,
      };
    });
}
