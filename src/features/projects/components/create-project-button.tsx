"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createProject } from "@/features/projects/actions/create-project";
import { SearchableSelect } from "@/components/ui/searchable-select";

type ClientOption = { id: string; name: string };

type CreateProjectButtonProps = {
  clients?: ClientOption[];
};

export function CreateProjectButton({
  clients = [],
}: CreateProjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProject({
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        city: String(formData.get("city") ?? "") || undefined,
        clientId: clientId || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setClientId("");
      router.push(`/projects/${result.projectId}`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" aria-hidden />
        Nueva obra
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="create-project-title"
            className="w-full max-w-md rounded-lg border border-border bg-surface-elevated p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="create-project-title"
                  className="font-display text-lg tracking-tight"
                >
                  Nueva obra
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se creará en tu organización actual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={onSubmit} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Código</span>
                <input
                  name="code"
                  required
                  placeholder="OB-2026-003"
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Nombre</span>
                <input
                  name="name"
                  required
                  placeholder="Nombre de la obra"
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Ciudad</span>
                <input
                  name="city"
                  placeholder="Santiago"
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Cliente</span>
                <SearchableSelect
                  value={clientId}
                  onChange={setClientId}
                  emptyLabel="Sin cliente (asignar después)"
                  searchPlaceholder="Buscar cliente…"
                  options={clients.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </label>

              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
                >
                  {pending ? "Creando…" : "Crear obra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
