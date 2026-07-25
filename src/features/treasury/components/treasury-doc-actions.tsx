"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod, TreasuryDocStatus } from "@prisma/client";
import {
  cancelPaymentOrder,
  cancelReceipt,
  issuePaymentOrder,
  issueReceipt,
  postPaymentOrder,
  postReceipt,
  syncPostedDocumentToCash,
} from "@/features/treasury/actions/treasury-actions";

type TreasuryDocActionsProps = {
  kind: "receipt" | "payment-order";
  id: string;
  status: TreasuryDocStatus;
  paymentMethod?: PaymentMethod;
  /** true si ya hay movimiento de caja ligado al documento */
  hasCashMovement?: boolean;
};

export function TreasuryDocActions({
  kind,
  id,
  status,
  paymentMethod,
  hasCashMovement = false,
}: TreasuryDocActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: (id: string) => Promise<{ ok: boolean; error?: string }>,
  ) {
    startTransition(async () => {
      const result = await action(id);
      if (!result.ok) {
        window.alert(result.error ?? "No se pudo completar la acción.");
        return;
      }
      router.refresh();
    });
  }

  const canSyncCash =
    status === "POSTED" &&
    !hasCashMovement &&
    (paymentMethod === "CASH" ||
      paymentMethod === "TRANSFER" ||
      paymentMethod === "OTHER");

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(kind === "receipt" ? issueReceipt : issuePaymentOrder)
          }
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
        >
          Emitir
        </button>
      )}
      {(status === "DRAFT" || status === "ISSUED") && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(kind === "receipt" ? postReceipt : postPaymentOrder)
          }
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          Imputar a presupuesto
        </button>
      )}
      {canSyncCash && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                paymentMethod === "CASH"
                  ? "¿Registrar este documento en la caja diaria abierta?"
                  : "Este documento figura como transferencia. ¿Marcarlo como efectivo y registrarlo en la caja diaria?",
              )
            ) {
              return;
            }
            startTransition(async () => {
              const result = await syncPostedDocumentToCash(kind, id);
              if (!result.ok) {
                window.alert(result.error ?? "No se pudo sincronizar con caja.");
                return;
              }
              router.refresh();
            });
          }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {paymentMethod === "CASH"
            ? "Registrar en caja"
            : "Pasar a efectivo y caja"}
        </button>
      )}
      {status !== "CANCELLED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "¿Anular el documento? Si estaba imputado, se revierte el impacto en partidas.",
              )
            ) {
              return;
            }
            run(kind === "receipt" ? cancelReceipt : cancelPaymentOrder);
          }}
          className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          Anular
        </button>
      )}
    </div>
  );
}
