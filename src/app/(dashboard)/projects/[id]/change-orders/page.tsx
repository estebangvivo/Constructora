import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listChangeOrders } from "@/features/change-orders/queries/list-change-orders";
import {
  CO_STATUS_LABEL,
  CO_STATUS_STYLE,
  formatCoMoney,
} from "@/features/change-orders/lib/labels";
import { formatDateAR } from "@/lib/format-date";

export default async function ChangeOrdersPage({ params }: ProjectRouteParams) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const orders = await listChangeOrders(id);
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );
  const currency = project.currency ?? "ARS";

  const approvedDelta = orders
    .filter((o) => o.status === "APPROVED")
    .reduce((a, o) => a + o.amountDelta, 0);
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">
            Órdenes de cambio
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Impacto contractual sobre el presupuesto. Al aprobar se actualizan
            las partidas.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/projects/${id}/change-orders/new`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
          >
            <Plus className="size-4" aria-hidden />
            Nueva ODC
          </Link>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Impacto aprobado
          </dt>
          <dd className="mt-1 font-display text-xl tabular-nums">
            {formatCoMoney(approvedDelta, currency)}
          </dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Pendientes
          </dt>
          <dd className="mt-1 font-display text-xl">{pendingCount}</dd>
        </div>
      </dl>

      {orders.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay órdenes de cambio.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {orders.map((item) => (
            <li key={item.id}>
              <Link
                href={`/projects/${id}/change-orders/${item.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {item.number}{" "}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CO_STATUS_STYLE[item.status]}`}
                    >
                      {CO_STATUS_LABEL[item.status]}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.title} · {item.itemCount} línea
                    {item.itemCount === 1 ? "" : "s"} ·{" "}
                    {formatDateAR(item.requestedAt)}
                  </p>
                </div>
                <p className="font-medium tabular-nums sm:text-right">
                  {formatCoMoney(item.amountDelta, currency)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
