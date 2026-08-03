"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { CertificationStatus } from "@prisma/client";
import {
  deleteCertification,
  setCertificationStatus,
} from "@/features/certifications/actions/certification-actions";

type CertificationActionsProps = {
  certificationId: string;
  projectId: string;
  status: CertificationStatus;
  canManage: boolean;
};

function isPresented(status: CertificationStatus) {
  return status === "SUBMITTED" || status === "APPROVED";
}

export function CertificationActions({
  certificationId,
  projectId,
  status,
  canManage,
}: CertificationActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const reportHref = `/projects/${projectId}/certifications/${certificationId}/print`;
  const showReport = isPresented(status) || status === "PAID";

  if (!canManage && !showReport) return null;

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    opts?: {
      redirectToList?: boolean;
      onSuccess?: () => void;
    },
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        window.alert(result.error ?? "No se pudo completar.");
        return;
      }
      if (opts?.onSuccess) {
        opts.onSuccess();
        return;
      }
      if (opts?.redirectToList) {
        router.push(`/projects/${projectId}/certifications`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showReport && (
        <Link
          href={reportHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
        >
          <FileText className="size-4" aria-hidden />
          Reporte cliente
        </Link>
      )}
      {canManage && (status === "DRAFT" || status === "REJECTED") && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              setCertificationStatus({
                certificationId,
                status: "APPROVED",
              }),
            )
          }
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          Presentar
        </button>
      )}
      {canManage && isPresented(status) && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                setCertificationStatus({
                  certificationId,
                  status: "PAID",
                }),
              {
                onSuccess: () => {
                  const emitPaymentOrder = window.confirm(
                    "Certificación liquidada.\n\n¿Deseás emitir una orden de pago para los obreros?",
                  );
                  if (emitPaymentOrder) {
                    const params = new URLSearchParams({
                      projectId,
                      certificationId,
                    });
                    router.push(
                      `/treasury/payment-orders/new?${params.toString()}`,
                    );
                    return;
                  }
                  const openReport = window.confirm(
                    "¿Generar el reporte para enviarle al cliente?",
                  );
                  if (openReport) {
                    router.push(reportHref);
                    return;
                  }
                  router.refresh();
                },
              },
            )
          }
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
        >
          Marcar liquidada
        </button>
      )}
      {canManage && isPresented(status) && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              setCertificationStatus({
                certificationId,
                status: "REJECTED",
              }),
            )
          }
          className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          Rechazar
        </button>
      )}
      {canManage && (status === "DRAFT" || status === "REJECTED") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("¿Eliminar esta certificación?")) return;
            run(() => deleteCertification(certificationId), {
              redirectToList: true,
            });
          }}
          className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          Eliminar
        </button>
      )}
    </div>
  );
}
