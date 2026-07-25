import type { CertificationStatus } from "@prisma/client";
import { normalizeCurrency } from "@/config/currencies";

export const CERT_STATUS_LABEL: Record<CertificationStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Presentada",
  APPROVED: "Aprobada",
  PAID: "Liquidada",
  REJECTED: "Rechazada",
};

export const CERT_STATUS_STYLE: Record<CertificationStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-accent/15 text-accent",
  APPROVED: "bg-success/15 text-success",
  PAID: "bg-success/25 text-success",
  REJECTED: "bg-danger/15 text-danger",
};

export function formatCertMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(value);
}

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundPct(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
