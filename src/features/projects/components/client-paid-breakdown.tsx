"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { formatMoneyByCurrency } from "@/config/currencies";
import {
  formatMoney,
  PAYMENT_METHOD_LABEL,
} from "@/features/treasury/lib/labels";
import type { ProjectClientPaidDocument } from "@/features/projects/queries/list-project-client-paid";

type ClientPaidBreakdownProps = {
  totalByCurrency: Record<string, number>;
  documents: ProjectClientPaidDocument[];
  pendingByCurrency?: Record<string, number>;
  /** Tamaño del monto principal en el resumen. */
  size?: "md" | "lg";
};

export function ClientPaidBreakdown({
  totalByCurrency,
  documents,
  pendingByCurrency,
  size = "lg",
}: ClientPaidBreakdownProps) {
  const [open, setOpen] = useState(false);
  const hasPending =
    pendingByCurrency != null &&
    Object.values(pendingByCurrency).some((v) => v > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border-l-2 border-success pl-3 text-left transition-opacity hover:opacity-80"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Cobrado del cliente
        </span>
        <span
          className={
            size === "lg"
              ? "mt-1 block font-display text-2xl tracking-tight"
              : "mt-1 block font-display text-xl"
          }
        >
          {formatMoneyByCurrency(totalByCurrency)}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {hasPending
            ? `Pendiente: ${formatMoneyByCurrency(pendingByCurrency)} · ver detalle`
            : documents.length > 0
              ? `${documents.length} recibo${documents.length === 1 ? "" : "s"} · ver detalle`
              : "Sin recibos imputados"}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="client-paid-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-surface-elevated shadow-lg"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2
                  id="client-paid-title"
                  className="font-display text-lg tracking-tight"
                >
                  Cobrado del cliente
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recibos imputados que conforman el saldo ·{" "}
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
                  No hay recibos imputados a esta obra.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {documents.map((doc) => {
                    const reduced =
                      doc.bouncedCheckAmount > 0.009 &&
                      doc.amount < doc.grossAmount - 0.009;
                    return (
                      <li key={doc.receiptId} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/treasury/receipts/${doc.receiptId}`}
                              className="font-medium text-accent hover:underline"
                              onClick={() => setOpen(false)}
                            >
                              {doc.number}
                            </Link>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {new Date(
                                `${doc.issueDate}T12:00:00`,
                              ).toLocaleDateString("es-AR")}
                              {" · "}
                              {PAYMENT_METHOD_LABEL[doc.paymentMethod]}
                              {doc.partyName ? ` · ${doc.partyName}` : ""}
                            </p>
                            {doc.concept ? (
                              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {doc.concept}
                              </p>
                            ) : null}
                            {reduced ? (
                              <p className="mt-1 text-xs text-danger">
                                Ajustado por cheque rechazado (bruto{" "}
                                {formatMoney(doc.grossAmount, doc.currency)}).
                                Los gastos del rechazo se ven en Costo real /
                                Pagado.
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 tabular-nums font-medium">
                            {formatMoney(doc.amount, doc.currency)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
