"use server";

import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { parseLocalDate } from "@/features/schedule/lib/gantt-range";
import { roundPct } from "@/features/schedule/lib/labels";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateSchedule(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/schedule`);
}

async function assertProject(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

function optionalDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = parseLocalDate(value.trim());
  if (!date) throw new Error("Fecha inválida.");
  return date;
}

async function assertNoCycle(
  projectId: string,
  taskId: string,
  predecessorId: string | null,
) {
  if (!predecessorId) return;
  if (predecessorId === taskId) {
    throw new Error("Una tarea no puede precederse a sí misma.");
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, predecessorId: true },
  });
  const byId = new Map(tasks.map((t) => [t.id, t.predecessorId]));
  if (!byId.has(predecessorId)) {
    throw new Error("El predecesor no pertenece a esta obra.");
  }

  let cursor: string | null = predecessorId;
  const seen = new Set<string>([taskId]);
  while (cursor) {
    if (seen.has(cursor)) {
      throw new Error("La dependencia genera un ciclo.");
    }
    seen.add(cursor);
    cursor = byId.get(cursor) ?? null;
  }
}

export async function createTask(input: {
  projectId: string;
  name: string;
  description?: string;
  status?: TaskStatus;
  progressPct?: number;
  plannedStart?: string;
  plannedEnd?: string;
  milestoneId?: string | null;
  predecessorId?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }
    await assertProject(input.projectId, session.organizationId);

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    const plannedStart = optionalDate(input.plannedStart);
    const plannedEnd = optionalDate(input.plannedEnd);
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
      return { ok: false, error: "La fecha fin debe ser ≥ inicio." };
    }

    const predecessorId = input.predecessorId || null;
    await assertNoCycle(input.projectId, "__new__", predecessorId);

    if (input.milestoneId) {
      const ms = await prisma.milestone.findFirst({
        where: { id: input.milestoneId, projectId: input.projectId },
      });
      if (!ms) return { ok: false, error: "Hito inválido." };
    }

    const last = await prisma.task.findFirst({
      where: { projectId: input.projectId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const progressPct = roundPct(
      Math.max(0, Math.min(100, Number(input.progressPct) || 0)),
    );
    let status: TaskStatus = input.status ?? "NOT_STARTED";
    if (progressPct >= 100) status = "COMPLETED";
    else if (progressPct > 0 && status === "NOT_STARTED") {
      status = "IN_PROGRESS";
    }

    const task = await prisma.task.create({
      data: {
        projectId: input.projectId,
        name,
        description: input.description?.trim() || null,
        status,
        progressPct,
        plannedStart,
        plannedEnd,
        milestoneId: input.milestoneId || null,
        predecessorId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        actualStart:
          status === "IN_PROGRESS" || status === "COMPLETED"
            ? plannedStart
            : null,
        actualEnd: status === "COMPLETED" ? plannedEnd : null,
      },
    });

    revalidateSchedule(input.projectId);
    return { ok: true, id: task.id };
  } catch (error) {
    console.error("createTask", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear.",
    };
  }
}

export async function updateTask(input: {
  taskId: string;
  name: string;
  description?: string;
  status?: TaskStatus;
  progressPct?: number;
  plannedStart?: string;
  plannedEnd?: string;
  milestoneId?: string | null;
  predecessorId?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.task.findFirst({
      where: {
        id: input.taskId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Tarea no encontrada." };

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    const plannedStart = optionalDate(input.plannedStart);
    const plannedEnd = optionalDate(input.plannedEnd);
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
      return { ok: false, error: "La fecha fin debe ser ≥ inicio." };
    }

    const predecessorId = input.predecessorId || null;
    await assertNoCycle(existing.projectId, existing.id, predecessorId);

    if (input.milestoneId) {
      const ms = await prisma.milestone.findFirst({
        where: { id: input.milestoneId, projectId: existing.projectId },
      });
      if (!ms) return { ok: false, error: "Hito inválido." };
    }

    const progressPct = roundPct(
      Math.max(0, Math.min(100, Number(input.progressPct) || 0)),
    );
    let status: TaskStatus = input.status ?? existing.status;
    if (progressPct >= 100) status = "COMPLETED";
    else if (progressPct > 0 && status === "NOT_STARTED") {
      status = "IN_PROGRESS";
    }

    await prisma.task.update({
      where: { id: existing.id },
      data: {
        name,
        description: input.description?.trim() || null,
        status,
        progressPct,
        plannedStart,
        plannedEnd,
        milestoneId: input.milestoneId || null,
        predecessorId,
        actualStart:
          status === "NOT_STARTED"
            ? null
            : (existing.actualStart ?? plannedStart),
        actualEnd: status === "COMPLETED" ? (plannedEnd ?? new Date()) : null,
      },
    });

    revalidateSchedule(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("updateTask", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Tarea no encontrada." };

    await prisma.task.updateMany({
      where: { predecessorId: existing.id },
      data: { predecessorId: null },
    });
    await prisma.task.delete({ where: { id: existing.id } });

    revalidateSchedule(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("deleteTask", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}

export async function createMilestone(input: {
  projectId: string;
  name: string;
  description?: string;
  dueDate?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }
    await assertProject(input.projectId, session.organizationId);

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    const last = await prisma.milestone.findFirst({
      where: { projectId: input.projectId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const milestone = await prisma.milestone.create({
      data: {
        projectId: input.projectId,
        name,
        description: input.description?.trim() || null,
        dueDate: optionalDate(input.dueDate),
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });

    revalidateSchedule(input.projectId);
    return { ok: true, id: milestone.id };
  } catch (error) {
    console.error("createMilestone", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear.",
    };
  }
}

export async function updateMilestone(input: {
  milestoneId: string;
  name: string;
  description?: string;
  dueDate?: string;
  completed?: boolean;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.milestone.findFirst({
      where: {
        id: input.milestoneId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Hito no encontrado." };

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    await prisma.milestone.update({
      where: { id: existing.id },
      data: {
        name,
        description: input.description?.trim() || null,
        dueDate: optionalDate(input.dueDate),
        completedAt: input.completed
          ? (existing.completedAt ?? new Date())
          : null,
      },
    });

    revalidateSchedule(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("updateMilestone", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function deleteMilestone(
  milestoneId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Hito no encontrado." };

    await prisma.task.updateMany({
      where: { milestoneId: existing.id },
      data: { milestoneId: null },
    });
    await prisma.milestone.delete({ where: { id: existing.id } });

    revalidateSchedule(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("deleteMilestone", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}
