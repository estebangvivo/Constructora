"use server";

import { revalidatePath } from "next/cache";
import type { PunchListPriority, PunchListStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { saveProjectUploadFile } from "@/lib/uploads";
import { parseLocalDate } from "@/features/schedule/lib/gantt-range";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidatePunch(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/punch-list`);
}

async function assertProject(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

export async function createPunchListItem(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const projectId = String(formData.get("projectId") ?? "");
    await assertProject(projectId, session.organizationId);

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "El título es obligatorio." };

    const description = String(formData.get("description") ?? "").trim() || null;
    const location = String(formData.get("location") ?? "").trim() || null;
    const priority = (String(formData.get("priority") ?? "MEDIUM") ||
      "MEDIUM") as PunchListPriority;
    const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
    const dueRaw = String(formData.get("dueDate") ?? "").trim();
    const dueDate = dueRaw ? parseLocalDate(dueRaw) : null;

    const photoUrls: string[] = [];
    const photos = formData.getAll("photos");
    for (const entry of photos) {
      if (!(entry instanceof File) || entry.size <= 0) continue;
      const saved = await saveProjectUploadFile({
        projectId,
        file: entry,
        folder: "punch-list",
        allowedKinds: "invoices", // solo imágenes/PDF
      });
      photoUrls.push(saved.fileUrl);
    }

    const item = await prisma.punchListItem.create({
      data: {
        projectId,
        createdById: session.user.id,
        assigneeId,
        title,
        description,
        location,
        priority,
        dueDate,
        photoUrls,
        status: "PENDING",
      },
    });

    revalidatePunch(projectId);
    return { ok: true, id: item.id };
  } catch (error) {
    console.error("createPunchListItem", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear.",
    };
  }
}

export async function updatePunchListItem(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const itemId = String(formData.get("itemId") ?? "");
    const existing = await prisma.punchListItem.findFirst({
      where: {
        id: itemId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Observación no encontrada." };

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "El título es obligatorio." };

    const description = String(formData.get("description") ?? "").trim() || null;
    const location = String(formData.get("location") ?? "").trim() || null;
    const priority = (String(formData.get("priority") ?? existing.priority) ||
      existing.priority) as PunchListPriority;
    const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
    const dueRaw = String(formData.get("dueDate") ?? "").trim();
    const dueDate = dueRaw ? parseLocalDate(dueRaw) : null;

    const photoUrls = [...existing.photoUrls];
    const photos = formData.getAll("photos");
    for (const entry of photos) {
      if (!(entry instanceof File) || entry.size <= 0) continue;
      const saved = await saveProjectUploadFile({
        projectId: existing.projectId,
        file: entry,
        folder: "punch-list",
        allowedKinds: "invoices",
      });
      photoUrls.push(saved.fileUrl);
    }

    await prisma.punchListItem.update({
      where: { id: existing.id },
      data: {
        title,
        description,
        location,
        priority,
        assigneeId,
        dueDate,
        photoUrls,
      },
    });

    revalidatePunch(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("updatePunchListItem", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function setPunchListStatus(input: {
  itemId: string;
  status: PunchListStatus;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.punchListItem.findFirst({
      where: {
        id: input.itemId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Observación no encontrada." };

    await prisma.punchListItem.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        resolvedAt: input.status === "RESOLVED" ? new Date() : null,
      },
    });

    revalidatePunch(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("setPunchListStatus", error);
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

export async function deletePunchListItem(itemId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.punchListItem.findFirst({
      where: {
        id: itemId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Observación no encontrada." };

    await prisma.punchListItem.delete({ where: { id: existing.id } });
    revalidatePunch(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("deletePunchListItem", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}
