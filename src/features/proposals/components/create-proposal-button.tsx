"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createProposal } from "@/features/proposals/actions/proposal-actions";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CreatePartyModal } from "@/features/parties/components/create-party-modal";

type ClientOption = { id: string; name: string };

export function CreateProposalButton({
  clients = [],
}: {
  clients?: ClientOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>(clients);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [newClientNameHint, setNewClientNameHint] = useState("");

  useEffect(() => {
    setClientOptions(clients);
  }, [clients]);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProposal({
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
      router.push(`/proposals/${result.proposalId}`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        <Plus className="size-4" aria-hidden />
        Nuevo presupuesto
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="create-proposal-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface-elevated p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2
                  id="create-proposal-title"
                  className="font-display text-lg tracking-tight"
                >
                  Nuevo presupuesto
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cotización previa. Si se aprueba, se crea la obra con estas
                  partidas.
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

            <form action={onSubmit} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Código *
                </span>
                <input
                  name="code"
                  required
                  placeholder="PRE-2026-001"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Nombre de la obra *
                </span>
                <input
                  name="name"
                  required
                  placeholder="Edificio Los Alerces"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Ciudad
                </span>
                <input
                  name="city"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                />
              </label>
              <div className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Cliente
                </span>
                <SearchableSelect
                  value={clientId}
                  onChange={setClientId}
                  emptyLabel="Sin cliente"
                  searchPlaceholder="Buscar cliente…"
                  createNewLabel="+ Nuevo cliente"
                  onCreateNew={(query) => {
                    setNewClientNameHint(query);
                    setClientModalOpen(true);
                  }}
                  options={clientOptions.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </div>

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
                  {pending ? "Creando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CreatePartyModal
        kind="client"
        open={clientModalOpen}
        initialName={newClientNameHint}
        onClose={() => {
          setClientModalOpen(false);
          setNewClientNameHint("");
        }}
        onCreated={(party) => {
          setClientOptions((prev) =>
            prev.some((p) => p.id === party.id)
              ? prev
              : [...prev, party].sort((a, b) =>
                  a.name.localeCompare(b.name, "es"),
                ),
          );
          setClientId(party.id);
          setClientModalOpen(false);
          setNewClientNameHint("");
        }}
      />
    </>
  );
}
