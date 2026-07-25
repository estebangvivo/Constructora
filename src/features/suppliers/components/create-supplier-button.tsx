"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createSupplier } from "@/features/suppliers/actions/supplier-actions";
import {
  TaxIdLookupFields,
  type PartyFormValues,
} from "@/features/arca/components/tax-id-lookup-fields";

const EMPTY: PartyFormValues = {
  taxId: "",
  name: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
};

export function CreateSupplierButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PartyFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSupplier({
        name: values.name,
        taxId: values.taxId || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        contactName: values.contactName || undefined,
        address: values.address || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setValues(EMPTY);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValues(EMPTY);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        <Plus className="size-4" aria-hidden />
        Nuevo proveedor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="create-supplier-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface-elevated p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2
                  id="create-supplier-title"
                  className="font-display text-lg tracking-tight"
                >
                  Nuevo proveedor
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Buscá por CUIT/DNI en ARCA para autocompletar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <TaxIdLookupFields
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              />

              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
                >
                  {pending ? "Guardando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
