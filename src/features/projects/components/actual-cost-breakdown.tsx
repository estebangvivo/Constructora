"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { formatMoneyByCurrency } from "@/config/currencies";
import {
  formatMoney,
  PAYMENT_METHOD_LABEL,
} from "@/features/treasury/lib/labels";
import type { ProjectCostDocument } from "@/features/projects/queries/list-project-cost-documents";
import { formatDateAR } from "@/lib/format-date";

type ActualCostBreakdownProps = {
  totalByCurrency: Record<string, number>;
  documents: ProjectCostDocument[];
  size?: "md" | "lg";
  /** Título del KPI (ej. Costo real / Pagado). */
  title?: string;
};

export function ActualCostBreakdown({
  totalByCurrency,
  documents,
  size = "md",
  title = "Costo real",
}: ActualCostBreakdownProps) {
  const [open, setOpen] = useState(false);
  const feeCount = documents.filter((d) => d.kind === "REJECTION_FEE").length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border-l-2 border-danger pl-3 text-left transition-opacity hover:opacity-80"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span
          className={
            size === "lg"
              ? "mt-1 block space-y-0.5 font-display text-2xl tracking-tight"
              : "mt-1 block space-y-0.5 font-display text-xl"
          }
        >
          {Object.keys(totalByCurrency).length === 0 ? (
            "—"
          ) : (
            Object.entries(totalByCurrency).map(([cur, amount]) => (
              <span key={cur} className="block">
                {formatMoney(amount, cur)}
              </span>
            ))
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {documents.length > 0
            ? `${documents.length} documento${documents.length === 1 ? "" : "s"}${
                feeCount > 0
                  ? ` · ${feeCount} gasto${feeCount === 1 ? "" : "s"} de rechazo`
                  : ""
              } · ver detalle`
            : "Sin egresos imputados"}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="actual-cost-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-surface-elevated shadow-lg"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2
                  id="actual-cost-title"
                  className="font-display text-lg tracking-tight"
                >
                  {title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Órdenes de pago y gastos de cheques rechazados ·{" "}
                  {formatMoneyByCurrency(totalByCurrency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay egresos imputados a esta obra.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {documents.map((doc) =>
                    doc.kind === "PAYMENT_ORDER" ? (
                      <li key={`po-${doc.id}`} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/treasury/payment-orders/${doc.id}`}
                              className="font-medium text-accent hover:underline"
                              onClick={() => setOpen(false)}
                            >
                              {doc.number}
                            </Link>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {formatDateAR(doc.issueDate)}
                              {" · "}
                              {PAYMENT_METHOD_LABEL[doc.paymentMethod]}
                              {doc.partyName ? ` · ${doc.partyName}` : ""}
                            </p>
                            {doc.concept ? (
                              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {doc.concept}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 tabular-nums font-medium">
                            {formatMoney(doc.amount, doc.currency)}
                          </p>
                        </div>
                      </li>
                    ) : (
                      <li key={`fee-${doc.id}`} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-danger">
                              {doc.description}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {formatDateAR(doc.issueDate)}
                              {" · Cheque "}
                              {doc.checkNumber} · {doc.checkBank}
                            </p>
                            {doc.budgetItemLabel ? (
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                Partida: {doc.budgetItemLabel}
                              </p>
                            ) : null}
                            {doc.passedToDrawer ? (
                              <p className="mt-1 text-xs text-accent">
                                Trasladado al librador
                                {doc.drawerName ? ` (${doc.drawerName})` : ""} ·
                                no suma al costo de obra
                              </p>
                            ) : null}
                            {doc.receiptId && doc.receiptNumber ? (
                              <Link
                                href={`/treasury/receipts/${doc.receiptId}`}
                                className="mt-0.5 inline-block text-sm text-accent hover:underline"
                                onClick={() => setOpen(false)}
                              >
                                {doc.receiptNumber}
                              </Link>
                            ) : null}
                          </div>
                          <p className="shrink-0 tabular-nums font-medium text-danger">
                            {formatMoney(doc.amount, doc.currency)}
                          </p>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
