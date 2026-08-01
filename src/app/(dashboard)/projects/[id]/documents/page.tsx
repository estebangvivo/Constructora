import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileStack, Plus } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import {
  listDocumentCategories,
  listProjectDocuments,
} from "@/features/documents/queries/list-documents";
import {
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPE_STYLE,
  DOCUMENT_TYPES,
} from "@/features/documents/lib/labels";
import { formatFileSize } from "@/lib/format-file-size";
import { formatDateAR } from "@/lib/format-date";

type PageProps = ProjectRouteParams & {
  searchParams: Promise<{ type?: string; category?: string }>;
};

export default async function DocumentsPage({ params, searchParams }: PageProps) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const sp = await searchParams;
  const project = await getProjectById(id);
  if (!project) notFound();

  const typeFilter =
    sp.type && DOCUMENT_TYPES.includes(sp.type as DocumentType)
      ? (sp.type as DocumentType)
      : "ALL";
  const categoryFilter = sp.category?.trim() || undefined;

  const [documents, categories] = await Promise.all([
    listProjectDocuments(id, {
      type: typeFilter,
      category: categoryFilter,
    }),
    listDocumentCategories(id),
  ]);

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  function hrefFor(next: { type?: string; category?: string }) {
    const q = new URLSearchParams();
    const t = next.type ?? (typeFilter === "ALL" ? "" : typeFilter);
    const c = next.category ?? categoryFilter ?? "";
    if (t) q.set("type", t);
    if (c) q.set("category", c);
    const qs = q.toString();
    return `/projects/${id}/documents${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">Documentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contratos, planos, especificaciones, informes y más.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/projects/${id}/documents/new`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
          >
            <Plus className="size-4" aria-hidden />
            Subir documento
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefFor({ type: "" })}
          className={`rounded-md px-3 py-1.5 text-sm ${
            typeFilter === "ALL"
              ? "bg-accent text-accent-foreground"
              : "border border-border hover:bg-surface"
          }`}
        >
          Todos
        </Link>
        {DOCUMENT_TYPES.map((t) => (
          <Link
            key={t}
            href={hrefFor({ type: t })}
            className={`rounded-md px-3 py-1.5 text-sm ${
              typeFilter === t
                ? "bg-accent text-accent-foreground"
                : "border border-border hover:bg-surface"
            }`}
          >
            {DOCUMENT_TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={hrefFor({ category: "" })}
            className={`rounded-md px-2.5 py-1 text-xs ${
              !categoryFilter
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas las carpetas
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={hrefFor({ category: c })}
              className={`rounded-md px-2.5 py-1 text-xs ${
                categoryFilter === c
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {documents.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <FileStack className="mx-auto mb-2 size-6 opacity-50" aria-hidden />
          Todavía no hay documentos
          {typeFilter !== "ALL" || categoryFilter
            ? " con este filtro"
            : ""}
          . Subí contratos, planos u otros archivos de la obra.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/projects/${id}/documents/${doc.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {doc.title}{" "}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${DOCUMENT_TYPE_STYLE[doc.type]}`}
                    >
                      {DOCUMENT_TYPE_LABEL[doc.type]}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {doc.category ? `${doc.category} · ` : ""}
                    v{doc.currentVersion}
                    {doc.fileName ? ` · ${doc.fileName}` : ""}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>{formatDateAR(doc.updatedAt)}</p>
                  <p>{formatFileSize(doc.fileSize)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
