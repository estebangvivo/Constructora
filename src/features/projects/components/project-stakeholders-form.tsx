"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProjectClient } from "@/features/clients/actions/client-actions";
import {
  linkSupplierToProject,
  unlinkSupplierFromProject,
} from "@/features/suppliers/actions/supplier-actions";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Option = { id: string; name: string; taxId: string | null };

type ProjectStakeholdersFormProps = {
  projectId: string;
  currentClientId: string | null;
  clients: Option[];
  linkedSuppliers: {
    supplierId: string;
    name: string;
    taxId: string | null;
    roleNotes: string | null;
    isPrimary: boolean;
  }[];
  availableSuppliers: Option[];
};

export function ProjectStakeholdersForm({
  projectId,
  currentClientId,
  clients,
  linkedSuppliers,
  availableSuppliers,
}: ProjectStakeholdersFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const linkedIds = new Set(linkedSuppliers.map((s) => s.supplierId));
  const unlinkable = availableSuppliers.filter((s) => !linkedIds.has(s.id));

  function onClientChange(clientId: string) {
    startTransition(async () => {
      await setProjectClient(projectId, clientId || null);
      router.refresh();
    });
  }

  function onLinkSupplier(formData: FormData) {
    startTransition(async () => {
      await linkSupplierToProject({
        projectId,
        supplierId: String(formData.get("supplierId") ?? ""),
        roleNotes: String(formData.get("roleNotes") ?? "") || undefined,
        isPrimary: formData.get("isPrimary") === "on",
      });
      router.refresh();
    });
  }

  function onUnlink(supplierId: string) {
    startTransition(async () => {
      await unlinkSupplierFromProject(projectId, supplierId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="font-medium">Cliente / Mandante</h3>
        <p className="text-sm text-muted-foreground">
          Un cliente principal por obra. Gestioná el catálogo en{" "}
          <a href="/clients" className="text-accent hover:underline">
            Clientes
          </a>
          .
        </p>
        <div className="max-w-md">
          <SearchableSelect
            value={currentClientId ?? ""}
            onChange={onClientChange}
            disabled={pending}
            emptyLabel="Sin cliente asignado"
            searchPlaceholder="Buscar cliente…"
            options={clients.map((c) => ({
              value: c.id,
              label: c.taxId ? `${c.name} · ${c.taxId}` : c.name,
              keywords: `${c.name} ${c.taxId ?? ""}`,
            }))}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-medium">Proveedores de la obra</h3>
          <p className="text-sm text-muted-foreground">
            Proveedores vinculados a esta obra (además del catálogo general).
          </p>
        </div>

        {linkedSuppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay proveedores vinculados.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {linkedSuppliers.map((s) => (
              <li
                key={s.supplierId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    {s.name}
                    {s.isPrimary && (
                      <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
                        Principal
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[s.taxId, s.roleNotes].filter(Boolean).join(" · ") ||
                      "Sin detalle"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onUnlink(s.supplierId)}
                  className="text-sm text-danger hover:underline disabled:opacity-60"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {unlinkable.length > 0 && (
          <form
            action={onLinkSupplier}
            className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4 sm:flex-row sm:items-end"
          >
            <label className="block flex-1 text-sm">
              <span className="mb-1 block text-muted-foreground">
                Agregar proveedor
              </span>
              <SupplierLinkSelect options={unlinkable} />
            </label>
            <label className="block flex-1 text-sm">
              <span className="mb-1 block text-muted-foreground">
                Rubro / notas
              </span>
              <input
                name="roleNotes"
                placeholder="Hormigón, fierro…"
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="flex items-center gap-2 pb-2.5 text-sm">
              <input type="checkbox" name="isPrimary" className="size-4" />
              Principal
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              Vincular
            </button>
          </form>
        )}

        {availableSuppliers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay proveedores en el catálogo. Creá uno en{" "}
            <a href="/suppliers" className="text-accent hover:underline">
              Proveedores
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function SupplierLinkSelect({ options }: { options: Option[] }) {
  const [value, setValue] = useState("");
  return (
    <SearchableSelect
      name="supplierId"
      value={value}
      onChange={setValue}
      emptyLabel="Seleccionar…"
      searchPlaceholder="Buscar proveedor…"
      options={options.map((s) => ({
        value: s.id,
        label: s.taxId ? `${s.name} · ${s.taxId}` : s.name,
        keywords: `${s.name} ${s.taxId ?? ""}`,
      }))}
    />
  );
}
