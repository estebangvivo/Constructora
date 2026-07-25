import type { TaskStatus } from "@prisma/client";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "No iniciada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  BLOCKED: "Bloqueada",
  CANCELLED: "Cancelada",
};

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-accent/15 text-accent",
  COMPLETED: "bg-success/15 text-success",
  BLOCKED: "bg-danger/15 text-danger",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};

export const TASK_BAR_CLASS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-muted-foreground/35",
  IN_PROGRESS: "bg-accent",
  COMPLETED: "bg-success",
  BLOCKED: "bg-danger",
  CANCELLED: "bg-muted-foreground/25",
};

export function roundPct(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
