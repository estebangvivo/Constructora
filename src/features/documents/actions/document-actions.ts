"use server";

import { revalidatePath } from "next/cache";
import type { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { saveProjectDocumentFile } from "@/lib/uploads";
import { DOCUMENT_TYPES } from "@/features/documents/lib/labels";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateDocs(projectId: string, documentId?: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents`);
  if (documentId) {
    revalidatePath(`/projects/${projectId}/documents/${documentId}`);
  }
}

async function assertProject(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

function parseType(value: FormDataEntryValue | null): DocumentType {
  const raw = typeof value === "string" ? value : "OTHER";
  return DOCUMENT_TYPES.includes(raw as DocumentType)
    ? (raw as DocumentType)
    : "OTHER";
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createDocument(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para subir documentos." };
    }

    const projectId = emptyToNull(formData.get("projectId"));
    if (!projectId) return { ok: false, error: "Obra inválida." };
    await assertProject(projectId, session.organizationId);

    const title = emptyToNull(formData.get("title"));
    if (!title) return { ok: false, error: "El título es obligatorio." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "Seleccioná un archivo." };
    }

    const saved = await saveProjectDocumentFile({ projectId, file });
    const type = parseType(formData.get("type"));
    const description = emptyToNull(formData.get("description"));
    const category = emptyToNull(formData.get("category"));

    const doc = await prisma.document.create({
      data: {
        projectId,
        uploadedById: session.user.id,
        title,
        description,
        type,
        category,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            fileName: saved.fileName,
            fileUrl: saved.fileUrl,
            fileSize: saved.fileSize,
            mimeType: saved.mimeType,
            changeNotes: "Versión inicial",
          },
        },
      },
    });

    revalidateDocs(projectId, doc.id);
    return { ok: true, id: doc.id };
  } catch (error) {
    console.error("createDocument", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo crear el documento.",
    };
  }
}

export async function updateDocumentMeta(input: {
  documentId: string;
  title: string;
  description?: string;
  type: DocumentType;
  category?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.document.findFirst({
      where: {
        id: input.documentId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Documento no encontrado." };

    const title = input.title.trim();
    if (!title) return { ok: false, error: "El título es obligatorio." };

    await prisma.document.update({
      where: { id: existing.id },
      data: {
        title,
        description: input.description?.trim() || null,
        type: DOCUMENT_TYPES.includes(input.type) ? input.type : "OTHER",
        category: input.category?.trim() || null,
      },
    });

    revalidateDocs(existing.projectId, existing.id);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("updateDocumentMeta", error);
    return { ok: false, error: "No se pudo actualizar." };
  }
}

export async function addDocumentVersion(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const documentId = emptyToNull(formData.get("documentId"));
    if (!documentId) return { ok: false, error: "Documento inválido." };

    const existing = await prisma.document.findFirst({
      where: {
        id: documentId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Documento no encontrado." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "Seleccioná un archivo." };
    }

    const saved = await saveProjectDocumentFile({
      projectId: existing.projectId,
      file,
    });
    const nextVersion = existing.currentVersion + 1;
    const changeNotes = emptyToNull(formData.get("changeNotes"));

    await prisma.$transaction([
      prisma.documentVersion.create({
        data: {
          documentId: existing.id,
          version: nextVersion,
          fileName: saved.fileName,
          fileUrl: saved.fileUrl,
          fileSize: saved.fileSize,
          mimeType: saved.mimeType,
          changeNotes,
        },
      }),
      prisma.document.update({
        where: { id: existing.id },
        data: {
          currentVersion: nextVersion,
          uploadedById: session.user.id,
        },
      }),
    ]);

    revalidateDocs(existing.projectId, existing.id);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("addDocumentVersion", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo subir la versión.",
    };
  }
}

export async function deleteDocument(
  documentId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.document.findFirst({
      where: {
        id: documentId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Documento no encontrado." };

    await prisma.document.delete({ where: { id: existing.id } });
    revalidateDocs(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("deleteDocument", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}
