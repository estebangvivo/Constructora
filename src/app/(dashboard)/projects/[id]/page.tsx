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
  Receipt,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { projectHref } from "@/config/navigation";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { getProjectFinancialSummary } from "@/features/projects/queries/get-project-financials";
import { listProjectClientPaidDocuments } from "@/features/projects/queries/list-project-client-paid";
import { listProjectCostDocuments } from "@/features/projects/queries/list-project-cost-documents";
import { getProjectDeleteBlockers } from "@/features/projects/actions/delete-project";
import { DeleteProjectButton } from "@/features/projects/components/delete-project-button";
import { ClientPaidBreakdown } from "@/features/projects/components/client-paid-breakdown";
import { ActualCostBreakdown } from "@/features/projects/components/actual-cost-breakdown";
import { ProjectOverviewCharts } from "@/features/projects/components/project-overview-charts";
import { ProjectClientAccount } from "@/features/projects/components/project-client-account";
import { listProjectSuppliers } from "@/features/suppliers/queries/list-suppliers";
import { formatBudgetMoney } from "@/features/budget/lib/labels";
import { getProjectClientAccountStatement } from "@/features/treasury/queries/account-statements";
import { getOrganizationSession } from "@/lib/auth";
import type { ProjectRouteParams } from "@/types";
import { notFound, redirect } from "next/navigation";

type QuickLink = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: (projectId: string) => string;
};

const QUICK_LINKS: QuickLink[] = [
  {
    title: "Emitir recibo",
    description: "Cobro del cliente imputado a esta obra",
    href: (projectId) => `/treasury/receipts/new?projectId=${projectId}`,
    icon: Receipt,
  },
  {
    title: "Emitir orden de pago",
    description: "Pago a proveedor imputado a esta obra",
    href: (projectId) => `/treasury/payment-orders/new?projectId=${projectId}`,
    icon: Banknote,
  },
  {
    title: "Cliente y proveedores",
    description: "Asigná mandante y proveedores de la obra",
    href: (projectId) => projectHref(projectId, "/stakeholders"),
    icon: Handshake,
  },
  {
    title: "Certificaciones",
    description: "Avance por partida y retenciones (documento interno)",
    href: (projectId) => projectHref(projectId, "/certifications"),
    icon: BadgePercent,
  },
  {
    title: "Presupuesto",
    description: "Partidas, estimado vs real y control financiero",
    href: (projectId) => projectHref(projectId, "/budget"),
    icon: Wallet,
  },
  {
    title: "Parte Diario",
    description: "Personal, clima, máquinas e incidencias del día",
    href: (projectId) => projectHref(projectId, "/daily-report"),
    icon: ClipboardList,
  },
  {
    title: "Punch List",
    description: "Observaciones con foto, estado y responsable",
    href: (projectId) => projectHref(projectId, "/punch-list"),
    icon: TriangleAlert,
  },
  {
    title: "Cronograma",
    description: "Tareas, hitos y vista Gantt",
    href: (projectId) => projectHref(projectId, "/schedule"),
    icon: CalendarRange,
  },
  {
    title: "Documentos",
    description: "Contratos, planos, especificaciones e informes",
    href: (projectId) => projectHref(projectId, "/documents"),
    icon: FileStack,
  },
  {
    title: "Compras",
    description: "Facturas de proveedor con desglose automático",
    href: (projectId) => projectHref(projectId, "/purchases"),
    icon: ShoppingCart,
  },
  {
    title: "Inventario",
    description: "Stock por categoría y consumo del día",
    href: (projectId) => projectHref(projectId, "/inventory"),
    icon: Package,
  },
];

export default async function ProjectOverviewPage({
  params,
}: ProjectRouteParams) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const canDeleteRole = ["ADMIN", "DIRECTOR"].includes(
    session.organizationRole,
  );

  const [suppliers, financials, clientPaidDocuments, costDocuments, deleteBlockers, clientAccount] =
    await Promise.all([
      listProjectSuppliers(id),
      getProjectFinancialSummary(id),
      listProjectClientPaidDocuments(id),
      listProjectCostDocuments(id),
      canDeleteRole ? getProjectDeleteBlockers(id) : Promise.resolve([]),
      project.clientId
        ? getProjectClientAccountStatement(id)
        : Promise.resolve(null),
    ]);

  const currency = financials?.currency ?? project.currency ?? "ARS";
  const clientPaidByCurrency = financials?.clientPaidByCurrency ?? {};
  const clientPendingByCurrency = financials?.clientPendingByCurrency ?? {};
  const paidOutByCurrency = financials?.paidOutByCurrency ?? {};
  const budgetEstimated = financials?.budgetEstimated ?? 0;
  const cobrado = financials?.clientPaidConverted ?? 0;
  const pagado = financials?.paidOutConverted ?? 0;
  const fxIncomplete = financials?.fxIncomplete ?? false;

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
          <ClientPaidBreakdown
            totalByCurrency={clientPaidByCurrency}
            documents={clientPaidDocuments}
            pendingByCurrency={clientPendingByCurrency}
            size="lg"
          />
          <ActualCostBreakdown
            totalByCurrency={
              Object.keys(paidOutByCurrency).length > 0
                ? paidOutByCurrency
                : financials?.budgetActualCost != null
                  ? { [currency]: financials.budgetActualCost }
                  : {}
            }
            documents={costDocuments}
            size="lg"
            title="Pagado / costo"
          />
          <div className="border-l-2 border-accent/40 pl-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Presupuesto
            </dt>
            <dd className="mt-1 font-display text-2xl tracking-tight">
              {budgetEstimated > 0
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
      </section>

      <ProjectOverviewCharts
        currency={currency}
        scheduleProgressPct={financials?.scheduleProgressPct ?? 0}
        budgetEstimated={budgetEstimated}
        cobrado={cobrado}
        pagado={pagado}
        fxIncomplete={fxIncomplete}
      />

      <ProjectClientAccount
        projectId={id}
        clientId={project.clientId}
        statement={clientAccount}
      />

      <section>
        <h2 className="mb-4 font-display text-xl tracking-tight">
          Accesos rápidos
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            const href = item.href(id);
            return (
              <li key={href}>
                <Link
                  href={href}
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
