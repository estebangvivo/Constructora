import type { PunchListPriority, PunchListStatus } from "@prisma/client";

export const PL_STATUS_LABEL: Record<PunchListStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  RESOLVED: "Resuelto",
};

export const PL_STATUS_STYLE: Record<PunchListStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  IN_PROGRESS: "bg-accent/15 text-accent",
  RESOLVED: "bg-success/15 text-success",
};

export const PL_PRIORITY_LABEL: Record<PunchListPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const PL_PRIORITY_STYLE: Record<PunchListPriority, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-foreground",
  HIGH: "text-warning",
  CRITICAL: "text-danger",
};
