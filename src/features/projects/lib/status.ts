import type { ProjectStatus } from "@prisma/client";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activa",
  ON_HOLD: "En pausa",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

/** Estilos sin opacidades (/15) para que el texto se lea en navegadores legacy. */
export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  ACTIVE: "border border-border bg-background text-foreground",
  ON_HOLD: "border border-border bg-background text-foreground",
  COMPLETED: "border border-border bg-muted text-foreground",
  DRAFT: "border border-border bg-muted text-foreground",
  CANCELLED: "border border-border bg-background text-foreground",
};
