"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createBudget,
  type BudgetItemInput,
} from "@/features/budget/actions/budget-actions";
import { BUDGET_UNITS, formatBudgetMoney } from "@/features/budget/lib/labels";
import { APP_CURRENCIES } from "@/config/currencies";

type LineState = BudgetItemInput & { key: string };

type CreateBudgetFormProps = {
  projectId: string;
  defaultCurrency?: string;
  enabledCurrencies?: string[];
};

function emptyLine(currency = "ARS"): LineState {
  return {
    key: Math.random().toString(36).slice(2),
    code: "",
    description: "",
    quantity: 1,
    unit: "u",
    unitCost: 0,
    currency,
  };
}

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function CreateBudgetForm({
  projectId,
  defaultCurrency = "ARS",
  enabledCurrencies = ["ARS", "USD"],
}: CreateBudgetFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Presupuesto Base");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>([
    emptyLine(defaultCurrency),
  ]);

  const totalsByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lines) {
      const cur = l.currency === "USD" ? "USD" : "ARS";
      const amount =
        (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
      map[cur] = (map[cur] ?? 0) + amount;
    }
    return map;
  }, [lines]);

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createBudget({
        projectId,
        name,
        currency,
        notes: notes || undefined,
        items: lines.map(({ key: _k, ...item }) => item),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="font-display text-xl tracking-tight">
          Alta de presupuesto
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Definí el presupuesto base y las partidas de la obra.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Nombre</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Moneda</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={fieldClass}
          >
            {enabledCurrencies.map((code) => {
              const short: Record<string, string> = {
                ARS: "Pesos (ARS)",
                USD: "Dólares (USD)",
              };
              const meta = APP_CURRENCIES.find((c) => c.code === code);
              return (
                <option key={code} value={code}>
                  {short[code] ?? meta?.label ?? code}
                </option>
              );
            })}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={fieldClass}
          />
        </label>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Partidas</h3>
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [...prev, emptyLine(currency)])
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
          >
            <Plus className="size-4" aria-hidden />
            Partida
          </button>
        </div>

        <ul className="space-y-3">
          {lines.map((line) => (
            <li
              key={line.key}
              className="grid gap-2 rounded-md border border-border bg-surface/50 p-3 sm:grid-cols-7"
            >
              <label className="block text-sm sm:col-span-1">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Código
                </span>
                <input
                  required
                  value={line.code}
                  onChange={(e) =>
                    updateLine(line.key, { code: e.target.value })
                  }
                  placeholder="01.01"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Descripción
                </span>
                <input
                  required
                  value={line.description}
                  onChange={(e) =>
                    updateLine(line.key, { description: e.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Cant.
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(line.key, {
                      quantity: Number(e.target.value),
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Ud.
                </span>
                <select
                  value={line.unit}
                  onChange={(e) =>
                    updateLine(line.key, { unit: e.target.value })
                  }
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
                  Moneda
                </span>
                <select
                  value={line.currency === "USD" ? "USD" : "ARS"}
                  onChange={(e) =>
                    updateLine(line.key, { currency: e.target.value })
                  }
                  className={fieldClass}
                >
                  <option value="ARS">Pesos (ARS)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </label>
              <div className="flex items-end gap-2">
                <label className="block min-w-0 flex-1 text-sm">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    P. unit. ({line.currency === "USD" ? "USD" : "ARS"})
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={line.unitCost || ""}
                    onChange={(e) =>
                      updateLine(line.key, {
                        unitCost: Number(e.target.value),
                      })
                    }
                    className={fieldClass}
                  />
                </label>
                <button
                  type="button"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((prev) => prev.filter((l) => l.key !== line.key))
                  }
                  className="mb-0.5 rounded-md p-2 text-danger hover:bg-danger/10 disabled:opacity-40"
                  aria-label="Quitar partida"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-1 text-right text-sm font-medium">
          {Object.entries(totalsByCurrency).map(([cur, amount]) => (
            <p key={cur}>
              Total {cur}: {formatBudgetMoney(amount, cur)}
            </p>
          ))}
        </div>
      </section>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear presupuesto"}
        </button>
      </div>
    </form>
  );
}
