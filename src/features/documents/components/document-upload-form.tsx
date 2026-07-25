"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocumentType } from "@prisma/client";
import { createDocument } from "@/features/documents/actions/document-actions";
import {
  DOCUMENT_CATEGORY_SUGGESTIONS,
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPES,
} from "@/features/documents/lib/labels";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type DocumentUploadFormProps = {
  projectId: string;
  categories?: string[];
};

export function DocumentUploadForm({
  projectId,
  categories = [],
}: DocumentUploadFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<DocumentType>("CONTRACT");
  const categoryOptions = Array.from(
    new Set([...DOCUMENT_CATEGORY_SUGGESTIONS, ...categories]),
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);
    formData.set("type", type);

    startTransition(async () => {
      const result = await createDocument(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/${projectId}/documents/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Título</span>
          <input
            name="title"
            required
            placeholder="Ej. Contrato de obra, Plano de estructura R2…"
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
          <span className="mb-1 block text-muted-foreground">
            Carpeta / categoría
          </span>
          <input
            name="category"
            list="doc-categories"
            placeholder="Ej. Legal, Estructural…"
            className={fieldClass}
          />
          <datalist id="doc-categories">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Descripción</span>
          <textarea
            name="description"
            rows={2}
            className={fieldClass}
            placeholder="Notas opcionales"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Archivo</span>
          <input
            name="file"
            type="file"
            required
            className={`${fieldClass} file:mr-3 file:rounded file:border-0 file:bg-accent/15 file:px-2 file:py-1 file:text-sm`}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            PDF, imágenes, Office, ZIP, DWG/DXF y similares · máx. 25 MB
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Subiendo…" : "Subir documento"}
        </button>
      </div>
    </form>
  );
}
