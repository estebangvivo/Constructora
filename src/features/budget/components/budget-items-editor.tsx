"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addBudgetItem,
  deleteBudgetItem,
  setBudgetStatus,
  updateBudgetItem,
  type BudgetItemInput,
} from "@/features/budget/actions/budget-actions";
import {
  BUDGET_UNITS,
  formatBudgetMoney,
} from "@/features/budget/lib/labels";
import { formatMoneyByCurrency } from "@/config/currencies";
import type { BudgetStatus } from "@prisma/client";

type BudgetItemRow = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  currency: string;
  actualCostByCurrency: Record<string, number>;
  actualCost: number;
  actualIncomeByCurrency: Record<string, number>;
  actualIncome: number;
  fxIncomplete?: boolean;
};

type BudgetItemsEditorProps = {
  budgetId: string;
  status: BudgetStatus;
  /** Moneda por defecto al agregar partidas nuevas. */
  defaultCurrency: string;
  items: BudgetItemRow[];
  canManage: boolean;
};

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none ring-accent focus:ring-2";

const LINE_CURRENCIES = [
  { code: "ARS", label: "Pesos" },
  { code: "USD", label: "Dólares" },
] as const;

function ItemFormFields({
  value,
  onChange,
}: {
  value: BudgetItemInput;
  onChange: (patch: Partial<BudgetItemInput>) => void;
}) {
  const currency = value.currency === "USD" ? "USD" : "ARS";

  return (
    <div className="grid gap-2 sm:grid-cols-7">
      <label className="block text-sm sm:col-span-1">
        <span className="mb-1 block text-xs text-muted-foreground">Código</span>
        <input
          required
          value={value.code}
          onChange={(e) => onChange({ code: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">
          Descripción
        </span>
        <input
          required
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Cant.</span>
        <input
          type="number"
          min={0}
          step="any"
          required
          value={value.quantity}
          onChange={(e) => onChange({ quantity: Number(e.target.value) })}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Ud.</span>
        <select
          value={value.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
          className={fieldClass}
        >
          {BUDGET_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Moneda</span>
        <select
          value={currency}
          onChange={(e) => onChange({ currency: e.target.value })}
          className={fieldClass}
          aria-label="Moneda de la partida"
        >
          {LINE_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} ({c.code})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">
          P. unit. ({currency})
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          required
          value={value.unitCost || ""}
          onChange={(e) => onChange({ unitCost: Number(e.target.value) })}
          className={fieldClass}
        />
      </label>
    </div>
  );
}

export function BudgetItemsEditor({
  budgetId,
  status,
  defaultCurrency,
  items,
  canManage,
}: BudgetItemsEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BudgetItemInput>({
    code: "",
    description: "",
    quantity: 1,
    unit: "u",
    unitCost: 0,
    currency: defaultCurrency === "USD" ? "USD" : "ARS",
  });

  const editable = canManage && status !== "LOCKED";

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Error");
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  function startEdit(item: BudgetItemRow) {
    setAdding(false);
    setEditingId(item.id);
    setDraft({
      code: item.code,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      currency: item.currency === "USD" ? "USD" : "ARS",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">Partidas</h3>
        <div className="flex flex-wrap gap-2">
          {editable && status === "DRAFT" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => setBudgetStatus({ budgetId, status: "APPROVED" }))
              }
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
            >
              Aprobar
            </button>
          )}
          {editable && status !== "DRAFT" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => setBudgetStatus({ budgetId, status: "LOCKED" }))
              }
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
            >
              Cerrar
            </button>
          )}
          {editable && (
            <button
              type="button"
              disabled={pending || adding}
              onClick={() => {
                setEditingId(null);
                setDraft({
                  code: "",
                  description: "",
                  quantity: 1,
                  unit: "u",
                  unitCost: 0,
                  currency: defaultCurrency === "USD" ? "USD" : "ARS",
                });
                setAdding(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              <Plus className="size-4" aria-hidden />
              Agregar partida
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="space-y-3 rounded-md border border-border bg-surface/50 p-3">
          <ItemFormFields
            value={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => addBudgetItem({ budgetId, item: draft }),
                  () => setAdding(false),
                )
              }
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              Guardar partida
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-3 pr-3 font-medium">Código</th>
              <th className="py-3 pr-3 font-medium">Descripción</th>
              <th className="py-3 pr-3 text-right font-medium">Cant.</th>
              <th className="py-3 pr-3 font-medium">Ud.</th>
              <th className="py-3 pr-3 font-medium">Moneda</th>
              <th className="py-3 pr-3 text-right font-medium">P. unit.</th>
              <th className="py-3 pr-3 text-right font-medium">Estimado</th>
              <th className="py-3 pr-3 text-right font-medium">Costo real</th>
              <th className="py-3 pr-3 text-right font-medium">
                Costo equiv.
              </th>
              <th className="py-3 pr-3 text-right font-medium">Ingreso real</th>
              <th className="py-3 pr-3 text-right font-medium">
                Ingreso equiv.
              </th>
              {editable && <th className="py-3 font-medium"> </th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={editable ? 12 : 11}
                  className="py-8 text-center text-muted-foreground"
                >
                  Sin partidas. Agregá la primera.
                </td>
              </tr>
            )}
            {items.map((item) =>
              editingId === item.id ? (
                <tr key={item.id} className="border-b border-border/70">
                  <td colSpan={editable ? 12 : 11} className="py-3">
                    <div className="space-y-3">
                      <ItemFormFields
                        value={draft}
                        onChange={(patch) =>
                          setDraft((prev) => ({ ...prev, ...patch }))
                        }
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                        >
                          <X className="size-4" />
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                updateBudgetItem({
                                  itemId: item.id,
                                  item: draft,
                                }),
                              () => setEditingId(null),
                            )
                          }
                          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={item.id}
                  className="border-b border-border/70 hover:bg-surface/60"
                >
                  <td className="py-3 pr-3 font-mono text-xs">{item.code}</td>
                  <td className="py-3 pr-3">{item.description}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{item.unit}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={
                        item.currency === "USD"
                          ? "rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent"
                          : "rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {item.currency === "USD" ? "USD · Dólares" : "ARS · Pesos"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {formatBudgetMoney(item.unitCost, item.currency)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {formatBudgetMoney(item.totalCost, item.currency)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-medium">
                    {formatMoneyByCurrency(item.actualCostByCurrency)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground">
                    <div>
                      {formatBudgetMoney(item.actualCost, item.currency)}
                    </div>
                    {item.fxIncomplete && (
                      <div className="text-[10px] text-danger">
                        Falta cotización
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-medium text-success">
                    {formatMoneyByCurrency(item.actualIncomeByCurrency)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground">
                    <div>
                      {formatBudgetMoney(item.actualIncome, item.currency)}
                    </div>
                    {item.fxIncomplete && (
                      <div className="text-[10px] text-danger">
                        Falta cotización
                      </div>
                    )}
                  </td>
                  {editable && (
                    <td className="py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => startEdit(item)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `¿Eliminar la partida ${item.code}?`,
                              )
                            ) {
                              return;
                            }
                            run(() => deleteBudgetItem(item.id));
                          }}
                          className="rounded-md p-1.5 text-danger hover:bg-danger/10"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
