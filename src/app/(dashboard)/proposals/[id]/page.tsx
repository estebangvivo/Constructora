import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getProposal } from "@/features/proposals/queries/list-proposals";
import { ProposalItemsEditor } from "@/features/proposals/components/proposal-items-editor";
import { ProposalActionsBar } from "@/features/proposals/components/proposal-actions-bar";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_STYLE,
} from "@/features/proposals/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) notFound();

  const role = session.organizationRole ?? "";
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
  const canApprove = ["ADMIN", "DIRECTOR"].includes(role);

  return (
    <div className="px-4 py-6 lg:px-6">
      <Link
        href="/proposals"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Presupuestos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {proposal.code}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${PROPOSAL_STATUS_STYLE[proposal.status]}`}
            >
              {PROPOSAL_STATUS_LABEL[proposal.status]}
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl tracking-tight">
            {proposal.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {[proposal.city, proposal.clientName].filter(Boolean).join(" · ") ||
              "Sin ciudad / cliente"}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <ProposalActionsBar
          proposalId={proposal.id}
          status={proposal.status}
          itemCount={proposal.items.length}
          canApprove={canApprove}
          canManage={canManage}
          convertedProjectId={proposal.convertedProjectId}
        />
      </div>

      <ProposalItemsEditor
        proposalId={proposal.id}
        status={proposal.status}
        defaultCurrency={proposal.currency}
        items={proposal.items}
        canManage={canManage}
      />
    </div>
  );
}
