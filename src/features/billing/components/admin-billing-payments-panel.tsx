"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveBillingPayment,
  rejectBillingPayment,
} from "@/features/billing/actions/admin-billing-actions";
import { formatDateTimeAR } from "@/lib/format-date";

type PendingPayment = {
  id: string;
  plan: string;
  method: string;
  currency: string;
  amount: number;
  fxRateUsed: number | null;
  companyName: string | null;
  organizationName: string | null;
  transferProofUrl: string | null;
  notes: string | null;
  createdAt: string;
  userEmail: string;
  userName: string;
};

export function AdminBillingPaymentsPanel({
  payments,
}: {
  payments: PendingPayment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        window.alert(result.error ?? "Error");
        return;
      }
      router.refresh();
    });
  }

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay transferencias pendientes de revisión.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {payments.map((p) => (
        <li
          key={p.id}
          className="rounded-lg border border-border p-4 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {p.companyName || p.organizationName || "Renovación"} · {p.plan}
              </p>
              <p className="text-muted-foreground">
                {p.userName} ({p.userEmail}) · {p.currency}{" "}
                {p.amount.toLocaleString("es-AR")}
                {p.fxRateUsed ? ` · TC ${p.fxRateUsed}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTimeAR(p.createdAt)}
              </p>
              {p.notes && (
                <p className="mt-1 text-muted-foreground">{p.notes}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => approveBillingPayment(p.id))}
                className="rounded-md bg-accent px-3 py-1.5 text-accent-foreground"
              >
                Aprobar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const reason = window.prompt("Motivo del rechazo (opcional)") ?? "";
                  run(() => rejectBillingPayment(p.id, reason));
                }}
                className="rounded-md border border-border px-3 py-1.5"
              >
                Rechazar
              </button>
            </div>
          </div>
          {p.transferProofUrl && (
            <div className="mt-3">
              {p.transferProofUrl.startsWith("data:application/pdf") ? (
                <a
                  href={p.transferProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Ver PDF del comprobante
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.transferProofUrl}
                  alt="Comprobante"
                  className="max-h-64 rounded-md border border-border object-contain"
                />
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
