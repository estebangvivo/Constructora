"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consumeInventoryItems } from "@/features/inventory/actions/inventory-actions";
import type { InventoryCategoryGroup } from "@/features/inventory/queries/list-inventory";
import { formatQty } from "@/features/inventory/lib/labels";
import { DateInput } from "@/components/ui/date-input";
import { toDateInputValue } from "@/lib/format-date";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type Props = {
  projectId: string;
  groups: InventoryCategoryGroup[];
  canManage: boolean;
};

export function ConsumeInventoryForm({ projectId, groups, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [qtyById, setQtyById] = useState<Record<string, number>>({});

  const items = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  if (!canManage || items.length === 0) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = Object.entries(qtyById)
      .map(([inventoryItemId, quantity]) => ({
        inventoryItemId,
        quantity: Number(quantity) || 0,
      }))
      .filter((l) => l.quantity > 0);

    startTransition(async () => {
      const result = await consumeInventoryItems({
        projectId,
        date,
        notes: notes || undefined,
        lines,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQtyById({});
      setNotes("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-border p-4">
      <div>
        <h3 className="font-medium">Consumo del día</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrá lo utilizado en obra. Si hay parte diario de esa fecha, queda
          vinculado.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Fecha</span>
          <DateInput
            required
            value={date}
            onChange={setDate}
            className="w-full bg-surface"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Notas</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={fieldClass}
            placeholder="Ej. Hormigonado losa…"
          />
        </label>
      </div>

      <div className="max-h-80 space-y-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.category}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.category}
            </p>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[1fr_7rem] items-center gap-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock {formatQty(item.quantityOnHand)} {item.unit}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    max={item.quantityOnHand}
                    placeholder="0"
                    value={qtyById[item.id] ?? ""}
                    onChange={(e) =>
                      setQtyById((prev) => ({
                        ...prev,
                        [item.id]: Number(e.target.value),
                      }))
                    }
                    className={`${fieldClass} text-right`}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Registrando…" : "Registrar consumo"}
      </button>
    </form>
  );
}
