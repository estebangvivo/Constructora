"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createChangeOrder,
  updateChangeOrder,
  type ChangeOrderLineInput,
} from "@/features/change-orders/actions/change-order-actions";
import type { BudgetItemOption } from "@/features/change-orders/queries/list-change-orders";
import { formatCoMoney, round2 } from "@/features/change-orders/lib/labels";

type LineState = {
  key: string;
  budgetItemId: string;
  description: string;
  quantityDelta: string;
  unitCostDelta: string;
  amountDelta: string;
};

type ChangeOrderFormProps = {
  projectId: string;
  currency: string;
  budgetItems: BudgetItemOption[];
  mode?: "create" | "edit";
  changeOrderId?: string;
  initial?: {
    title: string;
    description: string;
    notes: string;
    lines: {
      budgetItemId: string | null;
      description: string;
      quantityDelta: number;
      unitCostDelta: number;
      amountDelta: number;
    }[];
  };
};

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

function emptyLine(): LineState {
  return {
    key: crypto.randomUUID(),
    budgetItemId: "",
    description: "",
    quantityDelta: "0",
    unitCostDelta: "0",
    amountDelta: "0",
  };
}

export function ChangeOrderForm({
  projectId,
  currency,
  budgetItems,
  mode = "create",
  changeOrderId,
  initial,
}: ChangeOrderFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<LineState[]>(() =>
    initial?.lines?.length
      ? initial.lines.map((l) => ({
          key: crypto.randomUUID(),
          budgetItemId: l.budgetItemId ?? "",
          description: l.description,
          quantityDelta: String(l.quantityDelta),
          unitCostDelta: String(l.unitCostDelta),
          amountDelta: String(l.amountDelta),
        }))
      : [emptyLine()],
  );

  const totalDelta = useMemo(
    () =>
      round2(
        lines.reduce((a, l) => a + (Number(l.amountDelta) || 0), 0),
      ),
    [lines],
  );

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.budgetItemId !== undefined) {
          const item = budgetItems.find((b) => b.id === patch.budgetItemId);
          if (item && !next.description.trim()) {
            next.description = `${item.code} — ${item.description}`;
          }
        }
        return next;
      }),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: ChangeOrderLineInput[] = lines.map((l) => ({
      budgetItemId: l.budgetItemId || null,
      description: l.description,
      quantityDelta: Number(l.quantityDelta) || 0,
      unitCostDelta: Number(l.unitCostDelta) || 0,
      amountDelta: Number(l.amountDelta) || 0,
    }));

    startTransition(async () => {
      const result =
        mode === "edit" && changeOrderId
          ? await updateChangeOrder({
              changeOrderId,
              title,
              description,
              notes,
              lines: payload,
            })
          : await createChangeOrder({
              projectId,
              title,
              description,
              notes,
              lines: payload,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/${projectId}/change-orders/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Título</span>
          <input
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ej. Extra por cambio de terminaciones"
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Descripción</span>
          <textarea
            className={fieldClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Motivo y alcance de la orden de cambio"
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Notas internas</span>
          <textarea
            className={fieldClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Líneas de impacto</h3>
          <button
            type="button"
            onClick={() => setLines((p) => [...p, emptyLine()])}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
          >
            <Plus className="size-3.5" aria-hidden />
            Línea
          </button>
        </div>

        {budgetItems.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            No hay partidas de presupuesto. Podés cargar impacto libre; al
            aprobar no se actualizarán montos de partida.
          </p>
        )}

        <ul className="space-y-3">
          {lines.map((line, idx) => (
            <li
              key={line.key}
              className="space-y-3 rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Línea {idx + 1}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLines((p) => p.filter((l) => l.key !== line.key))
                    }
                    className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    aria-label="Quitar línea"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  Partida (opcional)
                </span>
                <select
                  className={fieldClass}
                  value={line.budgetItemId}
                  onChange={(e) =>
                    updateLine(line.key, { budgetItemId: e.target.value })
                  }
                >
                  <option value="">Sin partida / libre</option>
                  {budgetItems.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Descripción</span>
                <input
                  className={fieldClass}
                  value={line.description}
                  onChange={(e) =>
                    updateLine(line.key, { description: e.target.value })
                  }
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Δ Cantidad
                  </span>
                  <input
                    type="number"
                    step="0.0001"
                    className={fieldClass}
                    value={line.quantityDelta}
                    onChange={(e) =>
                      updateLine(line.key, { quantityDelta: e.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Δ Costo unit.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    className={fieldClass}
                    value={line.unitCostDelta}
                    onChange={(e) =>
                      updateLine(line.key, { unitCostDelta: e.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Δ Monto (+/−)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    className={fieldClass}
                    value={line.amountDelta}
                    onChange={(e) =>
                      updateLine(line.key, { amountDelta: e.target.value })
                    }
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-right text-sm">
          Impacto neto:{" "}
          <span className="font-medium tabular-nums">
            {formatCoMoney(totalDelta, currency)}
          </span>
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? "Guardando…"
            : mode === "edit"
              ? "Guardar cambios"
              : "Crear ODC"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2.5 text-sm hover:bg-surface disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
