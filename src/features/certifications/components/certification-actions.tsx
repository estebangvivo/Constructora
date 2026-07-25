"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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

export function CertificationActions({
  certificationId,
  projectId,
  status,
  canManage,
}: CertificationActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canManage) return null;

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
        router.push(`/projects/${projectId}/certifications`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "DRAFT" || status === "REJECTED") && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              setCertificationStatus({
                certificationId,
                status: "SUBMITTED",
              }),
            )
          }
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
        >
          Presentar
        </button>
      )}
      {(status === "DRAFT" ||
        status === "SUBMITTED" ||
        status === "REJECTED") && (
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
          Aprobar
        </button>
      )}
      {status === "APPROVED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              setCertificationStatus({
                certificationId,
                status: "PAID",
              }),
            )
          }
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
        >
          Marcar liquidada
        </button>
      )}
      {(status === "SUBMITTED" || status === "APPROVED") && (
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
      {(status === "DRAFT" || status === "REJECTED") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("¿Eliminar esta certificación?")) return;
            run(() => deleteCertification(certificationId), true);
          }}
          className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          Eliminar
        </button>
      )}
    </div>
  );
}
