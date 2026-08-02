"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";
import {
  saveAdminPlanPrices,
  type AdminPlanPriceRow,
} from "@/features/billing/actions/admin-plan-prices-actions";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type RowState = {
  id: string;
  label: string;
  isTrial: boolean;
  priceUsd: string;
  priceArs: string;
  discountPercent: string;
  discountUntil: string;
  discountPromoMonths: string;
  defaultPriceUsd: number;
  defaultPriceArs: number | null;
};

function toState(rows: AdminPlanPriceRow[]): RowState[] {
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    isTrial: r.isTrial,
    priceUsd: String(r.priceUsd),
    priceArs: r.priceArs != null ? String(r.priceArs) : "",
    discountPercent:
      r.discountPercent != null ? String(r.discountPercent) : "",
    discountUntil: r.discountUntil ?? "",
    discountPromoMonths:
      r.discountPromoMonths != null ? String(r.discountPromoMonths) : "",
    defaultPriceUsd: r.defaultPriceUsd,
    defaultPriceArs: r.defaultPriceArs,
  }));
}

export function AdminPlanPricesPanel({
  initialRows,
}: {
  initialRows: AdminPlanPriceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(() => toState(initialRows));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function updateRow(
    id: string,
    patch: Partial<
      Pick<
        RowState,
        | "priceUsd"
        | "priceArs"
        | "discountPercent"
        | "discountUntil"
        | "discountPromoMonths"
      >
    >,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    startTransition(async () => {
      const prices = rows.map((r) => {
        const priceUsd = Number(r.priceUsd.replace(",", "."));
        const arsRaw = r.priceArs.trim();
        const priceArs =
          arsRaw === "" ? null : Number(arsRaw.replace(",", "."));
        const discRaw = r.discountPercent.trim();
        const discountPercent =
          discRaw === "" ? null : Number(discRaw.replace(",", "."));
        const discountUntil = r.discountUntil.trim() || null;
        const monthsRaw = r.discountPromoMonths.trim();
        const discountPromoMonths =
          monthsRaw === "" ? null : Number(monthsRaw.replace(",", "."));
        return {
          id: r.id,
          priceUsd,
          priceArs,
          discountPercent,
          discountUntil,
          discountPromoMonths,
        };
      });
      const result = await saveAdminPlanPrices({ prices });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  function onResetDefaults() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        priceUsd: String(r.defaultPriceUsd),
        priceArs:
          r.defaultPriceArs != null ? String(r.defaultPriceArs) : "",
        discountPercent: "",
        discountUntil: "",
        discountPromoMonths: "",
      })),
    );
    setOk(false);
    setError(null);
  }

  return (
    <form onSubmit={onSave} className="max-w-6xl space-y-6">
      <div>
        <h2 className="inline-flex items-center gap-2 font-display text-xl tracking-tight">
          <DollarSign className="size-5" aria-hidden />
          Precios de planes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Descuento % + fecha límite para contratar + meses de duración en
          planes mensuales. Solo aplica a empresas nuevas (alta / primera
          contratación). Exentas y clientes que ya pagaron un plan no reciben
          la campaña. Quien contrate antes de la fecha goza ese % durante N
          meses; después renueva al precio de lista.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-border bg-surface/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">USD</th>
              <th className="px-3 py-2 font-medium">ARS (opcional)</th>
              <th className="px-3 py-2 font-medium">Desc. %</th>
              <th className="px-3 py-2 font-medium">Contratar hasta</th>
              <th className="px-3 py-2 font-medium">Meses promo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3">
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.id}</p>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={r.priceUsd}
                    onChange={(e) =>
                      updateRow(r.id, { priceUsd: e.target.value })
                    }
                    className={fieldClass}
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={r.isTrial ? "ej. 1" : "—"}
                    value={r.priceArs}
                    onChange={(e) =>
                      updateRow(r.id, { priceArs: e.target.value })
                    }
                    className={fieldClass}
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="—"
                    value={r.discountPercent}
                    onChange={(e) =>
                      updateRow(r.id, { discountPercent: e.target.value })
                    }
                    className={fieldClass}
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="date"
                    value={r.discountUntil}
                    onChange={(e) =>
                      updateRow(r.id, { discountUntil: e.target.value })
                    }
                    className={fieldClass}
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={1}
                    max={36}
                    step={1}
                    placeholder="ej. 6"
                    value={r.discountPromoMonths}
                    onChange={(e) =>
                      updateRow(r.id, {
                        discountPromoMonths: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-md border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Precios y descuentos guardados.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar precios"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onResetDefaults}
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
        >
          Restaurar valores por defecto
        </button>
      </div>
    </form>
  );
}
