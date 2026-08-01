import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { getProjectFinancialSummary } from "@/features/projects/queries/get-project-financials";
import { listProjectClientPaidDocuments } from "@/features/projects/queries/list-project-client-paid";
import { listProjectCostDocuments } from "@/features/projects/queries/list-project-cost-documents";
import { getProjectBudget } from "@/features/budget/queries/get-project-budget";
import { getEnabledCurrencies } from "@/features/settings/queries/get-organization";
import { CreateBudgetForm } from "@/features/budget/components/create-budget-form";
import { BudgetItemsEditor } from "@/features/budget/components/budget-items-editor";
import { ClientPaidBreakdown } from "@/features/projects/components/client-paid-breakdown";
import { ActualCostBreakdown } from "@/features/projects/components/actual-cost-breakdown";
import {
  BUDGET_STATUS_LABEL,
  BUDGET_STATUS_STYLE,
  formatBudgetMoney,
} from "@/features/budget/lib/labels";

export default async function BudgetPage({ params }: ProjectRouteParams) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const [budget, financials, clientPaidDocuments, costDocuments, enabledCurrencies] =
    await Promise.all([
      getProjectBudget(id),
      getProjectFinancialSummary(id),
      listProjectClientPaidDocuments(id),
      listProjectCostDocuments(id),
      getEnabledCurrencies(),
    ]);
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  if (!budget) {
    return (
      <div className="space-y-6">
        {canManage ? (
          <CreateBudgetForm
            projectId={id}
            defaultCurrency={project.currency ?? "ARS"}
            enabledCurrencies={enabledCurrencies}
          />
        ) : (
          <div className="space-y-2">
            <h2 className="font-display text-xl tracking-tight">Presupuesto</h2>
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Esta obra aún no tiene presupuesto.
            </p>
          </div>
        )}
      </div>
    );
  }

  const estimatedByCurrency = budget.items.reduce<Record<string, number>>(
    (acc, i) => {
      const key = i.currency || budget.currency;
      acc[key] = (acc[key] ?? 0) + i.totalCost;
      return acc;
    },
    {},
  );
  const actualCostByCurrency = budget.items.reduce<Record<string, number>>(
    (acc, i) => {
      for (const [cur, amount] of Object.entries(i.actualCostByCurrency)) {
        acc[cur] = (acc[cur] ?? 0) + amount;
      }
      return acc;
    },
    {},
  );
  const clientPaidByCurrency = financials?.clientPaidByCurrency ?? {};
  const clientPendingByCurrency = financials?.clientPendingByCurrency ?? {};
  const primaryCurrency = budget.currency;
  const estimated = estimatedByCurrency[primaryCurrency] ?? 0;
  const actualCostConverted = budget.items
    .filter((i) => (i.currency || budget.currency) === primaryCurrency)
    .reduce((acc, i) => acc + i.actualCost, 0);
  const variancePct = estimated
    ? (((actualCostConverted - estimated) / estimated) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">Presupuesto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {budget.name} · v{budget.version}{" "}
            <span
              className={`ml-1 rounded px-1.5 py-0.5 text-xs font-medium ${BUDGET_STATUS_STYLE[budget.status]}`}
            >
              {BUDGET_STATUS_LABEL[budget.status]}
            </span>
          </p>
          {budget.notes && (
            <p className="mt-1 text-sm text-muted-foreground">{budget.notes}</p>
          )}
        </div>
        <Link
          href="/treasury"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-elevated"
        >
          Emitir en Tesorería
        </Link>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Estimado
          </dt>
          <dd className="mt-1 space-y-0.5 font-display text-xl">
            {Object.keys(estimatedByCurrency).length === 0 ? (
              "—"
            ) : (
              Object.entries(estimatedByCurrency).map(([cur, amount]) => (
                <div key={cur}>{formatBudgetMoney(amount, cur)}</div>
              ))
            )}
          </dd>
        </div>
        <ClientPaidBreakdown
          totalByCurrency={clientPaidByCurrency}
          documents={clientPaidDocuments}
          pendingByCurrency={clientPendingByCurrency}
          size="md"
        />
        <ActualCostBreakdown
          totalByCurrency={actualCostByCurrency}
          documents={costDocuments}
          size="md"
        />
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Variación costo ({primaryCurrency})
          </dt>
          <dd className="mt-1 font-display text-xl">{variancePct}%</dd>
        </div>
      </dl>

      <BudgetItemsEditor
        budgetId={budget.budgetId}
        status={budget.status}
        defaultCurrency={budget.currency}
        items={budget.items}
        canManage={canManage}
      />
    </div>
  );
}
