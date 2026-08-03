"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { createClient } from "@/features/clients/actions/client-actions";
import {
  createSupplier,
  linkSupplierToProject,
} from "@/features/suppliers/actions/supplier-actions";
import { setProjectClient } from "@/features/clients/actions/client-actions";
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

export type CreatedParty = { id: string; name: string };

type CreatePartyModalProps = {
  kind: "client" | "supplier";
  open: boolean;
  onClose: () => void;
  onCreated: (party: CreatedParty) => void;
  /** Si se indica, vincula el nuevo proveedor/cliente a esta obra. */
  linkProjectId?: string | null;
};

export function CreatePartyModal({
  kind,
  open,
  onClose,
  onCreated,
  linkProjectId,
}: CreatePartyModalProps) {
  const [values, setValues] = useState<PartyFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open || typeof document === "undefined") return null;

  const title = kind === "client" ? "Nuevo cliente" : "Nuevo proveedor";
  const titleId =
    kind === "client" ? "create-party-client-title" : "create-party-supplier-title";
  const projectId = linkProjectId?.trim() || "";

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const payload = {
        name: values.name,
        taxId: values.taxId || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        contactName: values.contactName || undefined,
        address: values.address || undefined,
      };
      const result =
        kind === "client"
          ? await createClient(payload)
          : await createSupplier(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (projectId) {
        if (kind === "supplier") {
          const linked = await linkSupplierToProject({
            projectId,
            supplierId: result.id,
          });
          if (!linked.ok) {
            setError(
              `Proveedor creado, pero no se pudo vincular a la obra: ${linked.error}`,
            );
            onCreated({ id: result.id, name: values.name.trim() });
            return;
          }
        } else {
          const linked = await setProjectClient(projectId, result.id);
          if (!linked.ok) {
            setError(
              `Cliente creado, pero no se pudo asignar a la obra: ${linked.error}`,
            );
            onCreated({ id: result.id, name: values.name.trim() });
            return;
          }
        }
      }

      onCreated({ id: result.id, name: values.name.trim() });
      setValues(EMPTY);
      onClose();
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface-elevated p-5 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id={titleId} className="font-display text-lg tracking-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buscá por CUIT/DNI en ARCA para autocompletar.
              {projectId
                ? kind === "supplier"
                  ? " Se vinculará a la obra actual."
                  : " Se asignará como cliente de la obra actual."
                : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <TaxIdLookupFields
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          />

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending || !values.name.trim()}
              onClick={handleCreate}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Crear"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
