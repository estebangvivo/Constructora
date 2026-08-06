"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveProposalAndCreateProject,
  setProposalStatus,
} from "@/features/proposals/actions/proposal-actions";
import type { ProposalStatus } from "@prisma/client";

export function ProposalActionsBar({
  proposalId,
  status,
  itemCount,
  canApprove,
  canManage,
  convertedProjectId,
}: {
  proposalId: string;
  status: ProposalStatus;
  itemCount: number;
  canApprove: boolean;
  canManage: boolean;
  convertedProjectId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "CONVERTED" && convertedProjectId) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
        Presupuesto convertido en obra.{" "}
        <button
          type="button"
          className="font-medium underline"
          onClick={() => router.push(`/projects/${convertedProjectId}`)}
        >
          Ir a la obra
        </button>
      </div>
    );
  }

  if (!canManage) return null;

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await setProposalStatus({
                  proposalId,
                  status: "SENT",
                });
                if (!r.ok) setError(r.error);
                else router.refresh();
              });
            }}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Marcar como enviado
          </button>
        )}
        {(status === "DRAFT" || status === "SENT") && canApprove && (
          <button
            type="button"
            disabled={pending || itemCount === 0}
            title={
              itemCount === 0
                ? "Agregá al menos una partida"
                : "Crea la obra con este presupuesto"
            }
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await approveProposalAndCreateProject({
                  proposalId,
                });
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                if (r.projectId) {
                  router.push(`/projects/${r.projectId}`);
                  router.refresh();
                }
              });
            }}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Creando obra…" : "Aprobar y crear obra"}
          </button>
        )}
        {status !== "REJECTED" && status !== "CONVERTED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await setProposalStatus({
                  proposalId,
                  status: "REJECTED",
                });
                if (!r.ok) setError(r.error);
                else router.refresh();
              });
            }}
            className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10"
          >
            Rechazar
          </button>
        )}
        {status === "REJECTED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await setProposalStatus({
                  proposalId,
                  status: "DRAFT",
                });
                if (!r.ok) setError(r.error);
                else router.refresh();
              });
            }}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Reabrir borrador
          </button>
        )}
      </div>
    </div>
  );
}
