"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createPaymentOrder,
  createReceipt,
  type TreasuryLineInput,
  type TreasuryPaymentInput,
} from "@/features/treasury/actions/treasury-actions";
import { getBudgetItemsAction } from "@/features/treasury/actions/get-budget-items";
import type { PaymentMethod } from "@prisma/client";
import type { TreasuryProjectOption } from "@/features/treasury/queries/list-projects-for-treasury";
import { DateInput } from "@/components/ui/date-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatMoney, PAYMENT_METHOD_LABEL } from "@/features/treasury/lib/labels";

type Option = { id: string; name: string };
type BudgetItemOption = {
  id: string;
  code: string;
  description: string;
};

type LineState = TreasuryLineInput & { key: string };
type PaymentState = TreasuryPaymentInput & { key: string };

export type PortfolioCheckOption = {
  id: string;
  number: string;
  bank: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  drawerName: string | null;
  label: string;
};

export type BankAccountFormOption = {
  id: string;
  name: string;
  bankName: string;
  currency: string;
  label: string;
};

type TreasuryDocumentFormProps = {
  kind: "receipt" | "payment-order";
  projects: TreasuryProjectOption[];
  parties: Option[];
  defaultCurrency?: string;
  enabledCurrencies?: string[];
  defaultProjectId?: string;
  /** Solo órdenes de pago: cheques disponibles en cartera. */
  portfolioChecks?: PortfolioCheckOption[];
  /** Cuentas bancarias activas para transferencias. */
  bankAccounts?: BankAccountFormOption[];
  /** Facturas abiertas (OP) o certificaciones abiertas (recibo). */
  openDocuments?: {
    id: string;
    label: string;
    balance: number;
    currency: string;
  }[];
};

const METHOD_OPTIONS: PaymentMethod[] = [
  "CASH",
  "TRANSFER",
  "CHECK",
  "OTHER",
];

function emptyLine(projectId = ""): LineState {
  return {
    key: Math.random().toString(36).slice(2),
    description: "",
    amount: 0,
    projectId,
    budgetItemId: "",
  };
}

function emptyPayment(amount = 0): PaymentState {
  return {
    key: Math.random().toString(36).slice(2),
    method: "CASH",
    amount,
    bankAccountId: "",
    checkInstrumentId: "",
    isOwnCheck: false,
    checkNumber: "",
    checkBank: "",
    checkIssueDate: "",
    checkDueDate: "",
    checkAccount: "",
  };
}

function resolveDefaultPartyId(
  kind: "receipt" | "payment-order",
  projects: TreasuryProjectOption[],
  defaultProjectId?: string,
): string {
  if (!defaultProjectId) return "";
  const project = projects.find((p) => p.id === defaultProjectId);
  if (!project) return "";
  if (kind === "receipt") return project.clientId ?? "";
  return project.supplierIds[0] ?? "";
}

export function TreasuryDocumentForm({
  kind,
  projects,
  parties,
  defaultCurrency = "ARS",
  enabledCurrencies = ["ARS", "USD"],
  defaultProjectId = "",
  portfolioChecks = [],
  bankAccounts = [],
  openDocuments = [],
}: TreasuryDocumentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [partyId, setPartyId] = useState(() =>
    resolveDefaultPartyId(kind, projects, defaultProjectId),
  );
  const [partyName, setPartyName] = useState("");
  const [concept, setConcept] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>(() => [
    emptyLine(defaultProjectId),
  ]);
  const [payments, setPayments] = useState<PaymentState[]>(() => [
    emptyPayment(),
  ]);
  const [apps, setApps] = useState<
    { key: string; documentId: string; amount: string }[]
  >([]);
  const [budgetItemsByProject, setBudgetItemsByProject] = useState<
    Record<string, BudgetItemOption[]>
  >({});

  useEffect(() => {
    if (!defaultProjectId) return;
    void ensureBudgetItems(defaultProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProjectId]);

  const paymentsTotal = useMemo(
    () =>
      Math.round(
        payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) * 100,
      ) / 100,
    [payments],
  );

  // Con una sola línea, el monto de imputación sigue la suma de medios de pago.
  useEffect(() => {
    if (lines.length !== 1) return;
    setLines((prev) => {
      if (prev.length !== 1) return prev;
      if (Number(prev[0].amount) === paymentsTotal) return prev;
      return [{ ...prev[0], amount: paymentsTotal }];
    });
  }, [paymentsTotal, lines.length]);

  const linesTotal = useMemo(
    () =>
      Math.round(
        lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0) * 100,
      ) / 100,
    [lines],
  );

  const filteredProjects = useMemo(() => {
    const byParty = !partyId
      ? []
      : kind === "receipt"
        ? projects.filter((p) => p.clientId === partyId)
        : projects.filter((p) => p.supplierIds.includes(partyId));

    if (!defaultProjectId) return byParty;

    const pinned = projects.find((p) => p.id === defaultProjectId);
    if (!pinned) return byParty;
    if (byParty.some((p) => p.id === pinned.id)) return byParty;
    return [pinned, ...byParty];
  }, [kind, partyId, projects, defaultProjectId]);

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

  function updatePayment(key: string, patch: Partial<PaymentState>) {
    setPayments((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p)),
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

  function distributeLastLineFromPayments() {
    if (lines.length === 0) return;
    const others = lines
      .slice(0, -1)
      .reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    const last = lines[lines.length - 1];
    updateLine(last.key, {
      amount: Math.max(0, Math.round((paymentsTotal - others) * 100) / 100),
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload = {
        issueDate,
        concept: concept || undefined,
        currency,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          description: l.description,
          amount: Number(l.amount) || 0,
          projectId: l.projectId || undefined,
          budgetItemId: l.budgetItemId || undefined,
        })),
        payments: payments
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({
            method: p.method,
            amount: Number(p.amount) || 0,
            bankAccountId: p.bankAccountId || undefined,
            checkInstrumentId: p.isOwnCheck
              ? undefined
              : p.checkInstrumentId || undefined,
            isOwnCheck: kind === "payment-order" ? Boolean(p.isOwnCheck) : undefined,
            checkNumber: p.checkNumber || undefined,
            checkBank: p.checkBank || undefined,
            checkIssueDate: p.checkIssueDate || undefined,
            checkDueDate: p.checkDueDate || undefined,
            checkAccount: p.checkAccount || undefined,
          })),
      };

      const parsedApps = apps
        .map((a) => ({
          documentId: a.documentId,
          amount: Number(String(a.amount).replace(",", ".")) || 0,
        }))
        .filter((a) => a.documentId && a.amount > 0);

      const result =
        kind === "receipt"
          ? await createReceipt({
              ...payload,
              clientId: partyId || undefined,
              partyName: partyName || undefined,
              certificationApps: parsedApps,
            })
          : await createPaymentOrder({
              ...payload,
              supplierId: partyId || undefined,
              partyName: partyName || undefined,
              invoiceApps: parsedApps,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const detailHref =
        kind === "receipt"
          ? `/treasury/receipts/${result.id}`
          : `/treasury/payment-orders/${result.id}`;
      const printHref = `${detailHref}/print?autoPrint=1`;
      const wantsPrint = window.confirm(
        kind === "receipt"
          ? "Recibo creado. ¿Querés imprimir el reporte?"
          : "Orden de pago creada. ¿Querés imprimir el reporte?",
      );

      router.push(wantsPrint ? printHref : detailHref);
      router.refresh();
    });
  }

  const partyLabel = kind === "receipt" ? "Cliente" : "Proveedor";
  const linesDiff = Math.round((linesTotal - paymentsTotal) * 100) / 100;
  const singleLine = lines.length === 1;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Fecha</span>
          <DateInput
            required
            value={issueDate}
            onChange={setIssueDate}
            className="w-full"
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
          <span className="mb-1 block text-muted-foreground">{partyLabel}</span>
          <SearchableSelect
            value={partyId}
            onChange={onPartyChange}
            emptyLabel="Sin catálogo / otro"
            placeholder={`Elegir ${partyLabel.toLowerCase()}…`}
            searchPlaceholder={`Buscar ${partyLabel.toLowerCase()}…`}
            options={parties.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
          />
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Líneas / imputación</h3>
            <p className="text-sm text-muted-foreground">
              {singleLine
                ? "El monto se toma de la suma de medios de pago."
                : "Distribuí el total de medios de pago entre las partidas."}
              {partyId
                ? ` Solo obras del ${partyLabel.toLowerCase()} seleccionado.`
                : defaultProjectId
                  ? " Obra precargada desde el proyecto."
                  : ` Seleccioná un ${partyLabel.toLowerCase()} para listar obras.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!singleLine && (
              <button
                type="button"
                onClick={distributeLastLineFromPayments}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
              >
                Completar última con resto
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setLines((prev) => [...prev, emptyLine(defaultProjectId)])
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
            >
              <Plus className="size-4" aria-hidden />
              Línea
            </button>
          </div>
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
                    <SearchableSelect
                      value={line.projectId ?? ""}
                      disabled={!partyId && !defaultProjectId}
                      emptyLabel={
                        !partyId && !defaultProjectId
                          ? `Elegí ${partyLabel.toLowerCase()} primero`
                          : filteredProjects.length === 0
                            ? "Sin obras vinculadas"
                            : "Sin obra"
                      }
                      searchPlaceholder="Buscar obra…"
                      options={filteredProjects.map((p) => ({
                        value: p.id,
                        label: `${p.code} · ${p.name}`,
                        keywords: `${p.code} ${p.name}`,
                      }))}
                      onChange={(projectId) => {
                        updateLine(line.key, {
                          projectId,
                          budgetItemId: "",
                        });
                        void ensureBudgetItems(projectId);
                      }}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Partida (presupuesto)
                    </span>
                    <SearchableSelect
                      value={line.budgetItemId ?? ""}
                      disabled={!line.projectId}
                      emptyLabel="Sin partida"
                      searchPlaceholder="Buscar partida…"
                      options={items.map((item) => ({
                        value: item.id,
                        label: `${item.code} · ${item.description}`,
                        keywords: `${item.code} ${item.description}`,
                      }))}
                      onChange={(budgetItemId) =>
                        updateLine(line.key, { budgetItemId })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Monto
                      {singleLine ? " (desde medios de pago)" : ""}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      readOnly={singleLine}
                      value={
                        singleLine
                          ? paymentsTotal || ""
                          : line.amount || ""
                      }
                      onChange={(e) =>
                        updateLine(line.key, {
                          amount: Number(e.target.value),
                        })
                      }
                      className={`w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2 ${
                        singleLine ? "bg-muted text-muted-foreground" : ""
                      }`}
                    />
                  </label>
                  <div className="flex items-end justify-end">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.key !== line.key),
                          )
                        }
                        className="rounded-md p-2 text-danger hover:bg-danger/10"
                        aria-label="Quitar línea"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="tabular-nums">
            Total imputado: {formatMoney(linesTotal, currency)}
          </p>
          {paymentsTotal > 0 && linesDiff !== 0 && (
            <p className="text-danger" role="status">
              Debe igualar medios de pago ({formatMoney(paymentsTotal, currency)}
              ). Diferencia: {formatMoney(linesDiff, currency)}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Medios de pago</h3>
            <p className="text-sm text-muted-foreground">
              Cargá cómo se cobra o paga. Esa suma define el monto a imputar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPayments((prev) => [...prev, emptyPayment()])}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
          >
            <Plus className="size-4" aria-hidden />
            Medio
          </button>
        </div>

        <ul className="space-y-3">
          {payments.map((payment) => (
            <li
              key={payment.key}
              className="space-y-2 rounded-md border border-border bg-surface/50 p-3"
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Medio</span>
                  <select
                    value={payment.method}
                    onChange={(e) => {
                      const method = e.target.value as PaymentMethod;
                      updatePayment(payment.key, {
                        method,
                        bankAccountId: "",
                        checkInstrumentId: "",
                        checkNumber: "",
                        checkBank: "",
                        checkIssueDate: "",
                        checkDueDate: "",
                        checkAccount: "",
                      });
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Monto</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    readOnly={
                      kind === "payment-order" &&
                      payment.method === "CHECK" &&
                      !payment.isOwnCheck
                    }
                    value={payment.amount || ""}
                    onChange={(e) =>
                      updatePayment(payment.key, {
                        amount: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2 read-only:bg-muted/40"
                  />
                </label>
                <div className="flex items-end justify-end">
                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPayments((prev) =>
                          prev.filter((p) => p.key !== payment.key),
                        )
                      }
                      className="rounded-md p-2 text-danger hover:bg-danger/10"
                      aria-label="Quitar medio"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              {payment.method === "TRANSFER" && (
                <div className="space-y-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Cuenta bancaria
                    </span>
                    <select
                      required
                      value={payment.bankAccountId ?? ""}
                      onChange={(e) =>
                        updatePayment(payment.key, {
                          bankAccountId: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    >
                      <option value="">
                        {bankAccounts.filter((b) => b.currency === currency)
                          .length === 0
                          ? `No hay cuentas en ${currency}`
                          : "Elegí una cuenta…"}
                      </option>
                      {bankAccounts
                        .filter((b) => b.currency === currency)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {bankAccounts.filter((b) => b.currency === currency)
                    .length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Dá de alta una cuenta en{" "}
                      <a
                        href="/settings"
                        className="text-accent hover:underline"
                      >
                        Configuración
                      </a>
                      .
                    </p>
                  )}
                </div>
              )}

              {payment.method === "CHECK" && kind === "payment-order" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name={`check-mode-${payment.key}`}
                        checked={!payment.isOwnCheck}
                        onChange={() =>
                          updatePayment(payment.key, {
                            isOwnCheck: false,
                            bankAccountId: "",
                            checkInstrumentId: "",
                            checkNumber: "",
                            checkBank: "",
                            checkDueDate: "",
                            amount: 0,
                          })
                        }
                      />
                      De cartera
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name={`check-mode-${payment.key}`}
                        checked={Boolean(payment.isOwnCheck)}
                        onChange={() =>
                          updatePayment(payment.key, {
                            isOwnCheck: true,
                            checkInstrumentId: "",
                            checkNumber: "",
                            checkBank: "",
                            checkDueDate: "",
                            bankAccountId: "",
                          })
                        }
                      />
                      Cheque propio
                    </label>
                  </div>

                  {!payment.isOwnCheck ? (
                    <>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Cheque de cartera
                        </span>
                        <select
                          required
                          value={payment.checkInstrumentId ?? ""}
                          onChange={(e) => {
                            const check = portfolioChecks.find(
                              (c) => c.id === e.target.value,
                            );
                            if (!check) {
                              updatePayment(payment.key, {
                                checkInstrumentId: "",
                                amount: 0,
                                checkNumber: "",
                                checkBank: "",
                                checkIssueDate: "",
                                checkDueDate: "",
                                checkAccount: "",
                              });
                              return;
                            }
                            updatePayment(payment.key, {
                              checkInstrumentId: check.id,
                              amount: check.amount,
                              checkNumber: check.number,
                              checkBank: check.bank,
                              checkDueDate: check.dueDate ?? "",
                              checkIssueDate: "",
                              checkAccount: "",
                            });
                          }}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                        >
                          <option value="">
                            {portfolioChecks.length === 0
                              ? "No hay cheques en cartera"
                              : "Elegí un cheque…"}
                          </option>
                          {portfolioChecks
                            .filter(
                              (c) =>
                                c.id === payment.checkInstrumentId ||
                                !payments.some(
                                  (p) =>
                                    p.key !== payment.key &&
                                    p.checkInstrumentId === c.id,
                                ),
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      {portfolioChecks.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Imputá un recibo con cheque para que entre a cartera.{" "}
                          <a
                            href="/treasury/checks"
                            className="text-accent hover:underline"
                          >
                            Ver cartera
                          </a>
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-muted-foreground">
                          Cuenta emisora
                        </span>
                        <select
                          required
                          value={payment.bankAccountId ?? ""}
                          onChange={(e) =>
                            updatePayment(payment.key, {
                              bankAccountId: e.target.value,
                              checkBank:
                                bankAccounts.find((b) => b.id === e.target.value)
                                  ?.bankName ?? payment.checkBank,
                            })
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                        >
                          <option value="">Elegí cuenta…</option>
                          {bankAccounts
                            .filter((b) => b.currency === currency)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          N° cheque
                        </span>
                        <input
                          required
                          value={payment.checkNumber ?? ""}
                          onChange={(e) =>
                            updatePayment(payment.key, {
                              checkNumber: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Banco
                        </span>
                        <input
                          required
                          value={payment.checkBank ?? ""}
                          onChange={(e) =>
                            updatePayment(payment.key, {
                              checkBank: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Vencimiento
                        </span>
                        <DateInput
                          required
                          value={payment.checkDueDate ?? ""}
                          onChange={(iso) =>
                            updatePayment(payment.key, {
                              checkDueDate: iso,
                            })
                          }
                          className="w-full"
                        />
                      </label>
                      <p className="text-xs text-muted-foreground sm:col-span-2">
                        El banco se debita cuando se cumpla el vencimiento
                        (acción en cartera de cheques propios).
                      </p>
                    </div>
                  )}
                </div>
              )}

              {payment.method === "CHECK" && kind === "receipt" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      N° cheque
                    </span>
                    <input
                      required
                      value={payment.checkNumber ?? ""}
                      onChange={(e) =>
                        updatePayment(payment.key, {
                          checkNumber: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Banco
                    </span>
                    <input
                      required
                      value={payment.checkBank ?? ""}
                      onChange={(e) =>
                        updatePayment(payment.key, {
                          checkBank: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Emisión
                    </span>
                    <DateInput
                      value={payment.checkIssueDate ?? ""}
                      onChange={(iso) =>
                        updatePayment(payment.key, {
                          checkIssueDate: iso,
                        })
                      }
                      className="w-full"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Vencimiento
                    </span>
                    <DateInput
                      value={payment.checkDueDate ?? ""}
                      onChange={(iso) =>
                        updatePayment(payment.key, {
                          checkDueDate: iso,
                        })
                      }
                      className="w-full"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-muted-foreground">
                      Cuenta / sucursal
                    </span>
                    <input
                      value={payment.checkAccount ?? ""}
                      onChange={(e) =>
                        updatePayment(payment.key, {
                          checkAccount: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    />
                  </label>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-medium tabular-nums">
            Total a imputar: {formatMoney(paymentsTotal, currency)}
          </p>
        </div>
      </section>

      {openDocuments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg tracking-tight">
              {kind === "receipt"
                ? "Aplicar a certificaciones"
                : "Aplicar a facturas"}
            </h2>
            <button
              type="button"
              onClick={() =>
                setApps((prev) => [
                  ...prev,
                  {
                    key: Math.random().toString(36).slice(2),
                    documentId: openDocuments[0]?.id ?? "",
                    amount: "",
                  },
                ])
              }
              className="text-sm text-accent hover:underline"
            >
              + Agregar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Opcional. Si no aplicás, el movimiento queda a cuenta en la CT.
          </p>
          {apps.map((app) => (
            <div
              key={app.key}
              className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_8rem_auto]"
            >
              <select
                value={app.documentId}
                onChange={(e) =>
                  setApps((prev) =>
                    prev.map((a) =>
                      a.key === app.key
                        ? { ...a, documentId: e.target.value }
                        : a,
                    ),
                  )
                }
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              >
                {openDocuments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                inputMode="decimal"
                value={app.amount}
                onChange={(e) =>
                  setApps((prev) =>
                    prev.map((a) =>
                      a.key === app.key ? { ...a, amount: e.target.value } : a,
                    ),
                  )
                }
                placeholder="Monto"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
              <button
                type="button"
                onClick={() =>
                  setApps((prev) => prev.filter((a) => a.key !== app.key))
                }
                className="text-sm text-muted-foreground hover:text-danger"
              >
                Quitar
              </button>
            </div>
          ))}
        </section>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Notas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
        />
      </label>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {pending
            ? "Guardando…"
            : kind === "receipt"
              ? "Crear recibo"
              : "Crear orden de pago"}
        </button>
      </div>
    </form>
  );
}
