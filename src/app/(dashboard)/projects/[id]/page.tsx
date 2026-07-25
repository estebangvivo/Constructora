import Link from "next/link";
import {
  BadgePercent,
  ClipboardList,
  FileStack,
  Package,
  ShoppingCart,
  TriangleAlert,
  Wallet,
  CalendarRange,
  Handshake,
} from "lucide-react";
import { projectHref } from "@/config/navigation";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { getProjectFinancialSummary } from "@/features/projects/queries/get-project-financials";
import { getProjectDeleteBlockers } from "@/features/projects/actions/delete-project";
import { DeleteProjectButton } from "@/features/projects/components/delete-project-button";
import { listProjectSuppliers } from "@/features/suppliers/queries/list-suppliers";
import { formatBudgetMoney } from "@/features/budget/lib/labels";
import { formatMoneyByCurrency } from "@/config/currencies";
import { getSession } from "@/lib/auth";
import type { ProjectRouteParams } from "@/types";
import { notFound, redirect } from "next/navigation";

const QUICK_LINKS = [
  {
    title: "Cliente y proveedores",
    description: "Asigná mandante y proveedores de la obra",
    suffix: "/stakeholders",
    icon: Handshake,
  },
  {
    title: "Certificaciones",
    description: "Avance por partida y retenciones (documento interno)",
    suffix: "/certifications",
    icon: BadgePercent,
  },
  {
    title: "Presupuesto",
    description: "Partidas, estimado vs real y control financiero",
    suffix: "/budget",
    icon: Wallet,
  },
  {
    title: "Parte Diario",
    description: "Personal, clima, máquinas e incidencias del día",
    suffix: "/daily-report",
    icon: ClipboardList,
  },
  {
    title: "Punch List",
    description: "Observaciones con foto, estado y responsable",
    suffix: "/punch-list",
    icon: TriangleAlert,
  },
  {
    title: "Cronograma",
    description: "Tareas, hitos y vista Gantt",
    suffix: "/schedule",
    icon: CalendarRange,
  },
  {
    title: "Documentos",
    description: "Contratos, planos, especificaciones e informes",
    suffix: "/documents",
    icon: FileStack,
  },
  {
    title: "Compras",
    description: "Facturas de proveedor con desglose automático",
    suffix: "/purchases",
    icon: ShoppingCart,
  },
  {
    title: "Inventario",
    description: "Stock por categoría y consumo del día",
    suffix: "/inventory",
    icon: Package,
  },
];

export default async function ProjectOverviewPage({
  params,
}: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const canDeleteRole = ["ADMIN", "DIRECTOR"].includes(
    session.organizationRole,
  );

  const [suppliers, financials, deleteBlockers] = await Promise.all([
    listProjectSuppliers(id),
    getProjectFinancialSummary(id),
    canDeleteRole ? getProjectDeleteBlockers(id) : Promise.resolve([]),
  ]);

  const currency = financials?.currency ?? project.currency ?? "ARS";
  const clientPaidByCurrency = financials?.clientPaidByCurrency ?? {};
  const clientPendingByCurrency = financials?.clientPendingByCurrency ?? {};
  const budgetEstimated = financials?.budgetEstimated;
  const hasPending = Object.values(clientPendingByCurrency).some((v) => v > 0);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl tracking-tight">Resumen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vista general de la obra.
            </p>
          </div>
          {canDeleteRole && (
            <DeleteProjectButton
              projectId={id}
              projectName={project.name}
              blockers={deleteBlockers}
            />
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="border-l-2 border-accent/40 pl-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Cliente
            </dt>
            <dd className="mt-1 truncate font-display text-2xl tracking-tight">
              {project.clientName ?? "Sin asignar"}
            </dd>
            <p className="text-xs text-muted-foreground">Mandante</p>
          </div>
          <div className="border-l-2 border-success pl-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Cobrado del cliente
            </dt>
            <dd className="mt-1 font-display text-2xl tracking-tight">
              {formatMoneyByCurrency(clientPaidByCurrency)}
            </dd>
            <p className="text-xs text-muted-foreground">
              {hasPending
                ? `Pendiente: ${formatMoneyByCurrency(clientPendingByCurrency)}`
                : "Recibos imputados"}
            </p>
          </div>
          <div className="border-l-2 border-accent/40 pl-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Presupuesto
            </dt>
            <dd className="mt-1 font-display text-2xl tracking-tight">
              {budgetEstimated != null
                ? formatBudgetMoney(budgetEstimated, currency)
                : "—"}
            </dd>
            <p className="text-xs text-muted-foreground">Estimado</p>
          </div>
          <div className="border-l-2 border-accent/40 pl-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Proveedores
            </dt>
            <dd className="mt-1 font-display text-2xl tracking-tight">
              {suppliers.length}
            </dd>
            <p className="text-xs text-muted-foreground">Vinculados</p>
          </div>
        </dl>

        {budgetEstimated != null && budgetEstimated > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Presupuesto estimado:{" "}
            <span className="font-medium text-foreground">
              {formatBudgetMoney(budgetEstimated, currency)}
            </span>
            . El cobro se informa por moneda (ARS / USD) sin mezclar.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl tracking-tight">
          Accesos rápidos
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.suffix}>
                <Link
                  href={projectHref(id, item.suffix)}
                  className="flex gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-surface-elevated"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-accent">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
