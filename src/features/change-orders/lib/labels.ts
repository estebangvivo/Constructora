import type { ChangeOrderStatus } from "@prisma/client";

export const CO_STATUS_LABEL: Record<ChangeOrderStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

export const CO_STATUS_STYLE: Record<ChangeOrderStatus, string> = {
  PENDING: "bg-accent/15 text-accent",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-danger/15 text-danger",
};

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function formatCoMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency === "USD" ? "USD" : currency || "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}
