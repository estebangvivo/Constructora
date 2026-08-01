"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { saveAdminTransferBankConfig } from "@/features/billing/actions/admin-transfer-actions";
import type { TransferBankDetails } from "@/features/billing/lib/platform-billing-settings";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function AdminTransferBankPanel({
  initial,
}: {
  initial: TransferBankDetails;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function setField<K extends keyof TransferBankDetails>(
    key: K,
    value: TransferBankDetails[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    startTransition(async () => {
      const result = await saveAdminTransferBankConfig(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSave} className="max-w-xl space-y-6">
      <div>
        <h2 className="inline-flex items-center gap-2 font-display text-xl tracking-tight">
          <Landmark className="size-5" aria-hidden />
          Transferencia bancaria
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Alias, CBU y datos que ven los usuarios al elegir pagar por
          transferencia. Se muestran en el alta y la renovación de planes.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Titular</span>
          <input
            required
            value={form.accountName}
            onChange={(e) => setField("accountName", e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">CUIT</span>
          <input
            required
            value={form.taxId}
            onChange={(e) => setField("taxId", e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Banco (ARS)</span>
          <input
            value={form.bankNameArs}
            onChange={(e) => setField("bankNameArs", e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">CBU (ARS)</span>
          <input
            value={form.cbuArs}
            onChange={(e) => setField("cbuArs", e.target.value)}
            className={fieldClass}
            placeholder="22 dígitos"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Alias (ARS)</span>
          <input
            value={form.aliasArs}
            onChange={(e) => setField("aliasArs", e.target.value)}
            className={fieldClass}
            placeholder="EMPRESA.PAGOS"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Banco (USD)</span>
          <input
            value={form.bankNameUsd}
            onChange={(e) => setField("bankNameUsd", e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Cuenta USD</span>
          <input
            value={form.accountUsd}
            onChange={(e) => setField("accountUsd", e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Notas</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {error && (
        <p className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-md border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Datos de transferencia guardados.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
