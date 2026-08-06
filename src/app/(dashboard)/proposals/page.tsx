import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProposals } from "@/features/proposals/queries/list-proposals";
import { listActiveClients } from "@/features/clients/queries/list-clients";
import { CreateProposalButton } from "@/features/proposals/components/create-proposal-button";
import {
  formatProposalMoney,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_STYLE,
} from "@/features/proposals/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [proposals, clients] = await Promise.all([
    listProposals(),
    listActiveClients(),
  ]);

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Presupuestos</h1>
          <p className="mt-1 text-muted-foreground">
            Cotizaciones previas a la obra. Al aprobarlas se genera la obra con
            el presupuesto.
          </p>
        </div>
        <CreateProposalButton clients={clients} />
      </div>

      {proposals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-muted-foreground">
          Todavía no hay presupuestos. Creá el primero para cotizar una obra.
        </p>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => (
            <li key={p.id}>
              <Link
                href={`/proposals/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.code}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${PROPOSAL_STATUS_STYLE[p.status]}`}
                    >
                      {PROPOSAL_STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p.city, p.clientName].filter(Boolean).join(" · ") ||
                      "Sin ciudad / cliente"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums font-medium">
                    {formatProposalMoney(p.totalCost, p.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.itemCount} partida{p.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
