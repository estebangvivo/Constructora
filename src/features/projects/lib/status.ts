import type { ProjectStatus } from "@prisma/client";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activa",
  ON_HOLD: "En pausa",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  ON_HOLD: "bg-warning/15 text-warning",
  COMPLETED: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
  CANCELLED: "bg-danger/15 text-danger",
};
