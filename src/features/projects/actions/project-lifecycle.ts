"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { ProjectStatus } from "@prisma/client";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const OPEN_STATUSES: ProjectStatus[] = ["DRAFT", "ACTIVE", "ON_HOLD"];
const CLOSED_STATUSES: ProjectStatus[] = ["COMPLETED", "CANCELLED"];

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateProject(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

/** Marca la obra como terminada (sale del listado de pendientes). */
export async function completeProject(
  projectId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para cerrar obras." };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      select: { id: true, status: true },
    });
    if (!project) return { ok: false, error: "Obra no encontrada." };
    if (CLOSED_STATUSES.includes(project.status)) {
      return { ok: false, error: "La obra ya está finalizada." };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "COMPLETED" },
    });

    revalidateProject(projectId);
    return { ok: true };
  } catch (error) {
    console.error("completeProject", error);
    return { ok: false, error: "No se pudo marcar el fin de obra." };
  }
}

/** Reactiva una obra terminada o cancelada. */
export async function reopenProject(projectId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para reabrir obras." };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      select: { id: true, status: true },
    });
    if (!project) return { ok: false, error: "Obra no encontrada." };
    if (OPEN_STATUSES.includes(project.status)) {
      return { ok: false, error: "La obra ya está activa." };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "ACTIVE" },
    });

    revalidateProject(projectId);
    return { ok: true };
  } catch (error) {
    console.error("reopenProject", error);
    return { ok: false, error: "No se pudo reabrir la obra." };
  }
}
