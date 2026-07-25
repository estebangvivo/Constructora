"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TreasuryDocStatus } from "@prisma/client";
import {
  cancelPaymentOrder,
  cancelReceipt,
  issuePaymentOrder,
  issueReceipt,
  postPaymentOrder,
  postReceipt,
} from "@/features/treasury/actions/treasury-actions";

type TreasuryDocActionsProps = {
  kind: "receipt" | "payment-order";
  id: string;
  status: TreasuryDocStatus;
};

export function TreasuryDocActions({
  kind,
  id,
  status,
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
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          Imputar a presupuesto
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
