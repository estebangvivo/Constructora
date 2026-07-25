import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { getChangeOrderById } from "@/features/change-orders/queries/list-change-orders";
import { ChangeOrderActions } from "@/features/change-orders/components/change-order-actions";
import {
  CO_STATUS_LABEL,
  CO_STATUS_STYLE,
  formatCoMoney,
} from "@/features/change-orders/lib/labels";
import { formatDateAR } from "@/lib/format-date";

type Params = {
  params: Promise<{ id: string; coId: string }>;
};

export default async function ChangeOrderDetailPage({ params }: Params) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id, coId } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const co = await getChangeOrderById(coId);
  if (!co || co.projectId !== id) notFound();

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );
  const canDecide = ["ADMIN", "DIRECTOR"].includes(session.organizationRole);
  const currency = co.currency || project.currency || "ARS";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/projects/${id}/change-orders`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Órdenes de cambio
          </Link>
          <h2 className="mt-2 font-display text-xl tracking-tight">
            {co.number}{" "}
            <span
              className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CO_STATUS_STYLE[co.status]}`}
            >
              {CO_STATUS_LABEL[co.status]}
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{co.title}</p>
        </div>
        <ChangeOrderActions
          changeOrderId={co.id}
          projectId={id}
          status={co.status}
          canManage={canManage}
          canDecide={canDecide}
        />
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Impacto neto
          </dt>
          <dd className="mt-1 font-display text-lg tabular-nums">
            {formatCoMoney(co.amountDelta, currency)}
          </dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Solicitada
          </dt>
          <dd className="mt-1 text-sm">{formatDateAR(co.requestedAt)}</dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Decisión
          </dt>
          <dd className="mt-1 text-sm">
            {co.decidedAt
              ? `${formatDateAR(co.decidedAt)}${co.decidedBy ? ` · ${co.decidedBy}` : ""}`
              : "—"}
          </dd>
        </div>
      </dl>

      {co.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {co.description}
        </p>
      )}

      <div>
        <h3 className="mb-3 font-medium">Líneas</h3>
        <ul className="divide-y divide-border border-y border-border">
          {co.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-sm text-muted-foreground">
                  {item.budgetItemCode
                    ? `Partida ${item.budgetItemCode}`
                    : "Sin partida"}
                  {item.quantityDelta !== 0 &&
                    ` · Δ qty ${item.quantityDelta}`}
                  {item.unitCostDelta !== 0 &&
                    ` · Δ unit ${formatCoMoney(item.unitCostDelta, currency)}`}
                </p>
              </div>
              <p className="font-medium tabular-nums">
                {formatCoMoney(item.amountDelta, currency)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {co.notes && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Notas: </span>
          {co.notes}
        </p>
      )}
    </div>
  );
}
