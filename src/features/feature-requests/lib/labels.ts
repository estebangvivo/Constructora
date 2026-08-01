import type { FeatureRequestStatus } from "@prisma/client";

export const FEATURE_REQUEST_STATUS_LABEL: Record<
  FeatureRequestStatus,
  string
> = {
  OPEN: "Abierta",
  IN_REVIEW: "En revisión",
  AWAITING_USER: "Consulta pendiente",
  QUOTED: "Cotizada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  IMPLEMENTED: "Implementada",
  CLOSED: "Cerrada",
};

export const FEATURE_REQUEST_STATUS_OPTIONS: FeatureRequestStatus[] = [
  "OPEN",
  "IN_REVIEW",
  "AWAITING_USER",
  "QUOTED",
  "APPROVED",
  "REJECTED",
  "IMPLEMENTED",
  "CLOSED",
];
