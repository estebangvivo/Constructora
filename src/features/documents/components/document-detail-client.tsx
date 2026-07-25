"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocumentType } from "@prisma/client";
import {
  addDocumentVersion,
  deleteDocument,
  updateDocumentMeta,
} from "@/features/documents/actions/document-actions";
import {
  DOCUMENT_CATEGORY_SUGGESTIONS,
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPES,
} from "@/features/documents/lib/labels";
import { formatFileSize } from "@/lib/uploads";
import { formatDateAR } from "@/lib/format-date";
import type { DocumentDetail } from "@/features/documents/queries/list-documents";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type DocumentDetailClientProps = {
  document: DocumentDetail;
  canManage: boolean;
  categories: string[];
};

export function DocumentDetailClient({
  document,
  canManage,
  categories,
}: DocumentDetailClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description ?? "");
  const [type, setType] = useState<DocumentType>(document.type);
  const [category, setCategory] = useState(document.category ?? "");
  const categoryOptions = Array.from(
    new Set([...DOCUMENT_CATEGORY_SUGGESTIONS, ...categories]),
  );

  function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateDocumentMeta({
        documentId: document.id,
        title,
        description,
        type,
        category,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onAddVersion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("documentId", document.id);
    startTransition(async () => {
      const result = await addDocumentVersion(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      e.currentTarget.reset();
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm("¿Eliminar este documento y todas sus versiones?")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDocument(document.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/${document.projectId}/documents`);
      router.refresh();
    });
  }

  const latest = document.versions[0];

  return (
    <div className="space-y-8">
      {canManage ? (
        <form onSubmit={saveMeta} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted-foreground">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Tipo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocumentType)}
                className={fieldClass}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Categoría</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="doc-categories-edit"
                className={fieldClass}
              />
              <datalist id="doc-categories-edit">
                {categoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted-foreground">
                Descripción
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={fieldClass}
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              Eliminar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar datos"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Tipo</dt>
            <dd>{DOCUMENT_TYPE_LABEL[document.type]}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Categoría</dt>
            <dd>{document.category ?? "—"}</dd>
          </div>
          {document.description && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-muted-foreground">
                Descripción
              </dt>
              <dd>{document.description}</dd>
            </div>
          )}
        </dl>
      )}

      {latest && (
        <div className="border-l-2 border-accent pl-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Versión actual (v{latest.version})
          </p>
          <a
            href={latest.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-medium text-accent underline-offset-2 hover:underline"
          >
            {latest.fileName}
          </a>
          <p className="text-sm text-muted-foreground">
            {formatFileSize(latest.fileSize)}
            {latest.mimeType ? ` · ${latest.mimeType}` : ""}
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-medium">Historial de versiones</h3>
        <ul className="divide-y divide-border border-y border-border">
          {document.versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  v{v.version}{" "}
                  <a
                    href={v.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {v.fileName}
                  </a>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateAR(v.createdAt)} · {formatFileSize(v.fileSize)}
                  {v.changeNotes ? ` · ${v.changeNotes}` : ""}
                </p>
              </div>
              <a
                href={v.fileUrl}
                download={v.fileName}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Descargar
              </a>
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <section className="space-y-3">
          <h3 className="font-medium">Nueva versión</h3>
          <form onSubmit={onAddVersion} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Archivo</span>
              <input
                name="file"
                type="file"
                required
                className={`${fieldClass} file:mr-3 file:rounded file:border-0 file:bg-accent/15 file:px-2 file:py-1 file:text-sm`}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Notas del cambio
              </span>
              <input
                name="changeNotes"
                placeholder="Ej. Revisión estructural R3"
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {pending ? "Subiendo…" : "Subir versión"}
            </button>
          </form>
        </section>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
