"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { uploadPurchaseInvoice } from "@/features/purchases/actions/purchase-invoice-actions";

type Props = { projectId: string };

export function InvoiceUploadForm({ projectId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);

    startTransition(async () => {
      const result = await uploadPurchaseInvoice(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/${projectId}/purchases/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-md border border-dashed border-border bg-surface/40 p-6"
    >
      <div className="text-center">
        <Upload className="mx-auto size-8 text-accent" aria-hidden />
        <h3 className="mt-3 font-medium">Subir factura de compra</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF o imagen. El sistema desglosa automáticamente CUIT, número, fechas,
          IVA, total y líneas cuando el archivo lo permite.
        </p>
      </div>

      <label className="block cursor-pointer rounded-md border border-border bg-background px-4 py-8 text-center text-sm hover:bg-surface">
        <input
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          required
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        {fileName ? (
          <span className="font-medium">{fileName}</span>
        ) : (
          <span className="text-muted-foreground">
            Elegí o soltá el archivo acá
          </span>
        )}
      </label>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending
          ? "Leyendo y desglosando factura…"
          : "Subir y desglosar"}
      </button>
    </form>
  );
}
