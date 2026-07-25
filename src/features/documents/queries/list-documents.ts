import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { DocumentType } from "@prisma/client";

export type DocumentListItem = {
  id: string;
  title: string;
  description: string | null;
  type: DocumentType;
  category: string | null;
  currentVersion: number;
  updatedAt: Date;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
};

export type DocumentDetail = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  type: DocumentType;
  category: string | null;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
  uploadedByName: string | null;
  versions: {
    id: string;
    version: number;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    changeNotes: string | null;
    createdAt: Date;
  }[];
};

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
}

export async function listProjectDocuments(
  projectId: string,
  filters?: { type?: DocumentType | "ALL"; category?: string },
): Promise<DocumentListItem[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.document.findMany({
    where: {
      projectId,
      ...(filters?.type && filters.type !== "ALL"
        ? { type: filters.type }
        : {}),
      ...(filters?.category
        ? { category: filters.category }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  return rows.map((row) => {
    const latest = row.versions[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      category: row.category,
      currentVersion: row.currentVersion,
      updatedAt: row.updatedAt,
      fileName: latest?.fileName ?? null,
      fileUrl: latest?.fileUrl ?? null,
      mimeType: latest?.mimeType ?? null,
      fileSize: latest?.fileSize ?? null,
    };
  });
}

export async function listDocumentCategories(
  projectId: string,
): Promise<string[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.document.findMany({
    where: { projectId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  return rows
    .map((r) => r.category)
    .filter((c): c is string => Boolean(c?.trim()));
}

export async function getDocumentById(
  documentId: string,
): Promise<DocumentDetail | null> {
  const session = await requireSession();

  const row = await prisma.document.findFirst({
    where: {
      id: documentId,
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
      },
    },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true, email: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });

  if (!row) return null;

  const uploaderName = [row.uploadedBy?.firstName, row.uploadedBy?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    type: row.type,
    category: row.category,
    currentVersion: row.currentVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    uploadedByName: uploaderName || row.uploadedBy?.email || null,
    versions: row.versions.map((v) => ({
      id: v.id,
      version: v.version,
      fileName: v.fileName,
      fileUrl: v.fileUrl,
      fileSize: v.fileSize,
      mimeType: v.mimeType,
      changeNotes: v.changeNotes,
      createdAt: v.createdAt,
    })),
  };
}
