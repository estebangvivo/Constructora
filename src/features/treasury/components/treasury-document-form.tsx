"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createPaymentOrder,
  createReceipt,
  type CheckDetailsInput,
  type TreasuryLineInput,
} from "@/features/treasury/actions/treasury-actions";
import { getBudgetItemsAction } from "@/features/treasury/actions/get-budget-items";
import type { PaymentMethod } from "@prisma/client";
import type { TreasuryProjectOption } from "@/features/treasury/queries/list-projects-for-treasury";

type Option = { id: string; name: string };
type BudgetItemOption = {
  id: string;
  code: string;
  description: string;
};

type LineState = TreasuryLineInput & { key: string };

type TreasuryDocumentFormProps = {
  kind: "receipt" | "payment-order";
  projects: TreasuryProjectOption[];
  parties: Option[];
  defaultCurrency?: string;
  enabledCurrencies?: string[];
};

function emptyLine(): LineState {
  return {
    key: Math.random().toString(36).slice(2),
    description: "",
    amount: 0,
    projectId: "",
    budgetItemId: "",
  };
}

function emptyCheck(): CheckDetailsInput {
  return {
    checkNumber: "",
    checkBank: "",
    checkIssueDate: "",
    checkDueDate: "",
    checkAccount: "",
  };
}

export function TreasuryDocumentForm({
  kind,
  projects,
  parties,
  defaultCurrency = "ARS",
  enabledCurrencies = ["ARS", "USD"],
}: TreasuryDocumentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [partyId, setPartyId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [concept, setConcept] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("TRANSFER");
  const [check, setCheck] = useState<CheckDetailsInput>(emptyCheck);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [budgetItemsByProject, setBudgetItemsByProject] = useState<
    Record<string, BudgetItemOption[]>
  >({});

  const total = useMemo(
    () => lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0),
    [lines],
  );

  const filteredProjects = useMemo(() => {
    if (!partyId) return [];
    if (kind === "receipt") {
      return projects.filter((p) => p.clientId === partyId);
    }
    return projects.filter((p) => p.supplierIds.includes(partyId));
  }, [kind, partyId, projects]);

  async function ensureBudgetItems(projectId: string) {
    if (!projectId || budgetItemsByProject[projectId]) return;
    const items = await getBudgetItemsAction(projectId);
    setBudgetItemsByProject((prev) => ({ ...prev, [projectId]: items }));
  }

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function onPartyChange(nextPartyId: string) {
    setPartyId(nextPartyId);
    const allowed = new Set(
      projects
        .filter((p) =>
          kind === "receipt"
            ? p.clientId === nextPartyId
            : p.supplierIds.includes(nextPartyId),
        )
        .map((p) => p.id),
    );
    setLines((prev) =>
      prev.map((line) => {
        if (!line.projectId || allowed.has(line.projectId)) return line;
        return { ...line, projectId: "", budgetItemId: "" };
      }),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (paymentMethod === "CHECK") {
      if (!check.checkNumber?.trim() || !check.checkBank?.trim()) {
        setError("Completá número y banco del cheque.");
        return;
      }
    }

    startTransition(async () => {
      const checkPayload =
        paymentMethod === "CHECK"
          ? {
              checkNumber: check.checkNumber,
              checkBank: check.checkBank,
              checkIssueDate: check.checkIssueDate || undefined,
              checkDueDate: check.checkDueDate || undefined,
              checkAccount: check.checkAccount || undefined,
            }
          : undefined;

      const payload = {
        issueDate,
        concept: concept || undefined,
        paymentMethod,
        currency,
        notes: notes || undefined,
        check: checkPayload,
        lines: lines.map((l) => ({
          description: l.description,
          amount: Number(l.amount) || 0,
          projectId: l.projectId || undefined,
          budgetItemId: l.budgetItemId || undefined,
        })),
      };

      const result =
        kind === "receipt"
          ? await createReceipt({
              ...payload,
              clientId: partyId || undefined,
              partyName: partyName || undefined,
            })
          : await createPaymentOrder({
              ...payload,
              supplierId: partyId || undefined,
              partyName: partyName || undefined,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(
        kind === "receipt"
          ? `/treasury/receipts/${result.id}`
          : `/treasury/payment-orders/${result.id}`,
      );
      router.refresh();
    });
  }

  const partyLabel = kind === "receipt" ? "Cliente" : "Proveedor";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Fecha</span>
          <input
            type="date"
            required
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Moneda</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
          >
            {enabledCurrencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Medio de pago</span>
          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as PaymentMethod)
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
          >
            <option value="TRANSFER">Transferencia</option>
            <option value="CASH">Efectivo</option>
            <option value="CHECK">Cheque</option>
            <option value="OTHER">Otro</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{partyLabel}</span>
          <select
            value={partyId}
            onChange={(e) => onPartyChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
          >
            <option value="">Sin catálogo / otro</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Nombre libre (si no hay {partyLabel.toLowerCase()})
          </span>
          <input
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Concepto</span>
          <input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ej. Cobro certificación N° 3 / Pago hormigón"
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
          />
        </label>
      </div>

      {paymentMethod === "CHECK" && (
        <section className="space-y-3 rounded-md border border-border bg-surface/40 p-4">
          <div>
            <h3 className="font-medium">Datos del cheque</h3>
            <p className="text-sm text-muted-foreground">
              Número y banco son obligatorios.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Número de cheque
              </span>
              <input
                required
                value={check.checkNumber ?? ""}
                onChange={(e) =>
                  setCheck((prev) => ({
                    ...prev,
                    checkNumber: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Banco</span>
              <input
                required
                value={check.checkBank ?? ""}
                onChange={(e) =>
                  setCheck((prev) => ({ ...prev, checkBank: e.target.value }))
                }
                placeholder="Ej. Banco Nación"
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Fecha de emisión
              </span>
              <input
                type="date"
                value={check.checkIssueDate ?? ""}
                onChange={(e) =>
                  setCheck((prev) => ({
                    ...prev,
                    checkIssueDate: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Fecha de cobro / vencimiento
              </span>
              <input
                type="date"
                value={check.checkDueDate ?? ""}
                onChange={(e) =>
                  setCheck((prev) => ({
                    ...prev,
                    checkDueDate: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted-foreground">
                Cuenta / sucursal (opcional)
              </span>
              <input
                value={check.checkAccount ?? ""}
                onChange={(e) =>
                  setCheck((prev) => ({
                    ...prev,
                    checkAccount: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
              />
            </label>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Líneas / imputación</h3>
            <p className="text-sm text-muted-foreground">
              {partyId
                ? `Solo obras vinculadas al ${partyLabel.toLowerCase()} seleccionado.`
                : `Seleccioná un ${partyLabel.toLowerCase()} arriba para listar sus obras.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
          >
            <Plus className="size-4" aria-hidden />
            Línea
          </button>
        </div>

        <ul className="space-y-3">
          {lines.map((line) => {
            const items = line.projectId
              ? (budgetItemsByProject[line.projectId] ?? [])
              : [];
            return (
              <li
                key={line.key}
                className="space-y-2 rounded-md border border-border bg-surface/50 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-muted-foreground">
                      Descripción
                    </span>
                    <input
                      required
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.key, { description: e.target.value })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">Obra</span>
                    <select
                      value={line.projectId ?? ""}
                      disabled={!partyId}
                      onChange={(e) => {
                        const projectId = e.target.value;
                        updateLine(line.key, {
                          projectId,
                          budgetItemId: "",
                        });
                        void ensureBudgetItems(projectId);
                      }}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2 disabled:opacity-50"
                    >
                      <option value="">
                        {!partyId
                          ? `Elegí ${partyLabel.toLowerCase()} primero`
                          : filteredProjects.length === 0
                            ? "Sin obras vinculadas"
                            : "Sin obra"}
                      </option>
                      {filteredProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} · {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Partida (presupuesto)
                    </span>
                    <select
                      value={line.budgetItemId ?? ""}
                      disabled={!line.projectId}
                      onChange={(e) =>
                        updateLine(line.key, {
                          budgetItemId: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2 disabled:opacity-50"
                    >
                      <option value="">Sin partida</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.description}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Monto
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={line.amount || ""}
                      onChange={(e) =>
                        updateLine(line.key, {
                          amount: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((prev) =>
                          prev.filter((l) => l.key !== line.key),
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-right text-sm font-medium">
          Total:{" "}
          {new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: currency || "ARS",
          }).format(total)}
        </p>
      </section>

      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Notas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
        />
      </label>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Crear borrador"}
        </button>
      </div>
    </form>
  );
}
