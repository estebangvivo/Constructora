"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChangeOrderStatus } from "@prisma/client";
import {
  deleteChangeOrder,
  setChangeOrderStatus,
} from "@/features/change-orders/actions/change-order-actions";

type ChangeOrderActionsProps = {
  changeOrderId: string;
  projectId: string;
  status: ChangeOrderStatus;
  canManage: boolean;
  canDecide: boolean;
};

export function ChangeOrderActions({
  changeOrderId,
  projectId,
  status,
  canManage,
  canDecide,
}: ChangeOrderActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canManage && !canDecide) return null;

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    redirectToList = false,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        window.alert(result.error ?? "No se pudo completar.");
        return;
      }
      if (redirectToList) {
        router.push(`/projects/${projectId}/change-orders`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && canDecide && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  "¿Aprobar esta ODC? Se aplicarán los deltas al presupuesto.",
                )
              ) {
                return;
              }
              run(() =>
                setChangeOrderStatus({
                  changeOrderId,
                  status: "APPROVED",
                }),
              );
            }}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            Aprobar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("¿Rechazar esta orden de cambio?")) return;
              run(() =>
                setChangeOrderStatus({
                  changeOrderId,
                  status: "REJECTED",
                }),
              );
            }}
            className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
          >
            Rechazar
          </button>
        </>
      )}
      {status === "PENDING" && canManage && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              router.push(
                `/projects/${projectId}/change-orders/${changeOrderId}/edit`,
              )
            }
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("¿Eliminar esta ODC pendiente?")) return;
              run(() => deleteChangeOrder(changeOrderId), true);
            }}
            className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
          >
            Eliminar
          </button>
        </>
      )}
    </div>
  );
}
