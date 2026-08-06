"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  addProposalItem,
  deleteProposalItem,
  updateProposalItem,
  type ProposalItemInput,
} from "@/features/proposals/actions/proposal-actions";
import { BUDGET_UNITS } from "@/features/budget/lib/labels";
import { formatProposalMoney } from "@/features/proposals/lib/labels";
import type { ProposalStatus } from "@prisma/client";

type ItemRow = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  currency: string;
};

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none ring-accent focus:ring-2";

const emptyItem = (currency: string): ProposalItemInput => ({
  code: "",
  description: "",
  quantity: 1,
  unit: "u",
  unitCost: 0,
  currency,
});

function ItemFormFields({
  value,
  onChange,
}: {
  value: ProposalItemInput;
  onChange: (patch: Partial<ProposalItemInput>) => void;
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
        <span className="mb-1 block text-xs text-muted-foreground">
          Costo unit.
        </span>
        <input
          type="number"
          min={0}
          step="any"
          required
          value={value.unitCost}
          onChange={(e) => onChange({ unitCost: Number(e.target.value) })}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Moneda</span>
        <select
          value={currency}
          onChange={(e) => onChange({ currency: e.target.value })}
          className={fieldClass}
        >
          <option value="ARS">Pesos</option>
          <option value="USD">Dólares</option>
        </select>
      </label>
    </div>
  );
}

export function ProposalItemsEditor({
  proposalId,
  status,
  defaultCurrency,
  items,
  canManage,
}: {
  proposalId: string;
  status: ProposalStatus;
  defaultCurrency: string;
  items: ItemRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ProposalItemInput>(() =>
    emptyItem(defaultCurrency),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProposalItemInput | null>(null);

  const editable = canManage && status !== "CONVERTED" && status !== "REJECTED";
  const total = items.reduce((s, i) => s + i.totalCost, 0);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Error");
        return;
      }
      setAdding(false);
      setEditingId(null);
      setEditDraft(null);
      setDraft(emptyItem(defaultCurrency));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Partidas</h2>
          <p className="text-sm text-muted-foreground">
            Total estimado:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatProposalMoney(total, defaultCurrency)}
            </span>
          </p>
        </div>
        {editable && !adding && (
          <button
            type="button"
            onClick={() => {
              setDraft(emptyItem(defaultCurrency));
              setAdding(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            <Plus className="size-4" />
            Agregar partida
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {adding && (
        <form
          className="rounded-lg border border-border bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addProposalItem({ proposalId, item: draft }));
          }}
        >
          <ItemFormFields
            value={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2">Ud.</th>
              <th className="px-3 py-2 text-right">Unitario</th>
              <th className="px-3 py-2 text-right">Total</th>
              {editable && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={editable ? 7 : 6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Todavía no hay partidas.
                </td>
              </tr>
            )}
            {items.map((item) =>
              editingId === item.id && editDraft ? (
                <tr key={item.id} className="border-t border-border bg-muted/20">
                  <td colSpan={editable ? 7 : 6} className="p-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() =>
                          updateProposalItem({
                            itemId: item.id,
                            item: editDraft,
                          }),
                        );
                      }}
                    >
                      <ItemFormFields
                        value={editDraft}
                        onChange={(patch) =>
                          setEditDraft((d) => (d ? { ...d, ...patch } : d))
                        }
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(null);
                          }}
                          className="rounded-md border border-border px-3 py-1.5 text-sm"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={pending}
                          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
                        >
                          Guardar
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2">{item.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatProposalMoney(item.unitCost, item.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatProposalMoney(item.totalCost, item.currency)}
                  </td>
                  {editable && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Editar"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditDraft({
                              code: item.code,
                              description: item.description,
                              quantity: item.quantity,
                              unit: item.unit,
                              unitCost: item.unitCost,
                              currency: item.currency,
                            });
                          }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Eliminar"
                          disabled={pending}
                          onClick={() =>
                            run(() => deleteProposalItem({ itemId: item.id }))
                          }
                          className="rounded-md p-1.5 text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="size-3.5" />
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
    </div>
  );
}
