import type { BudgetStatus } from "@prisma/client";
import { normalizeCurrency } from "@/config/currencies";

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobado",
  REVISED: "Revisado",
  LOCKED: "Cerrado",
};

export const BUDGET_STATUS_STYLE: Record<BudgetStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  APPROVED: "bg-success/15 text-success",
  REVISED: "bg-accent/15 text-accent",
  LOCKED: "bg-danger/15 text-danger",
};

export const BUDGET_UNITS = [
  "u",
  "m²",
  "m³",
  "ml",
  "kg",
  "tn",
  "gl",
  "hh",
  "día",
  "mes",
] as const;

export function formatBudgetMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(value);
}
