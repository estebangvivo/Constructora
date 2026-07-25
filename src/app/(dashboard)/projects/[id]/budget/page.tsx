import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { getProjectFinancialSummary } from "@/features/projects/queries/get-project-financials";
import { getProjectBudget } from "@/features/budget/queries/get-project-budget";
import { getEnabledCurrencies } from "@/features/settings/queries/get-organization";
import { CreateBudgetForm } from "@/features/budget/components/create-budget-form";
import { BudgetItemsEditor } from "@/features/budget/components/budget-items-editor";
import {
  BUDGET_STATUS_LABEL,
  BUDGET_STATUS_STYLE,
  formatBudgetMoney,
} from "@/features/budget/lib/labels";
import { formatMoneyByCurrency } from "@/config/currencies";

export default async function BudgetPage({ params }: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const [budget, financials, enabledCurrencies] = await Promise.all([
    getProjectBudget(id),
    getProjectFinancialSummary(id),
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

  const estimated = budget.items.reduce((s, i) => s + i.totalCost, 0);
  const actualCost = budget.items.reduce((s, i) => s + i.actualCost, 0);
  const clientPaidByCurrency = financials?.clientPaidByCurrency ?? {};
  const clientPendingByCurrency = financials?.clientPendingByCurrency ?? {};
  const variancePct = estimated
    ? (((actualCost - estimated) / estimated) * 100).toFixed(1)
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
          <dd className="mt-1 font-display text-xl">
            {formatBudgetMoney(estimated, budget.currency)}
          </dd>
        </div>
        <div className="border-l-2 border-success pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Cobrado del cliente
          </dt>
          <dd className="mt-1 font-display text-xl">
            {formatMoneyByCurrency(clientPaidByCurrency)}
          </dd>
          {Object.values(clientPendingByCurrency).some((v) => v > 0) && (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              Pendiente: {formatMoneyByCurrency(clientPendingByCurrency)}
            </dd>
          )}
        </div>
        <div className="border-l-2 border-danger pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Costo real (OP)
          </dt>
          <dd className="mt-1 font-display text-xl">
            {formatBudgetMoney(actualCost, budget.currency)}
          </dd>
        </div>
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Variación costo
          </dt>
          <dd className="mt-1 font-display text-xl">{variancePct}%</dd>
        </div>
      </dl>

      <BudgetItemsEditor
        budgetId={budget.budgetId}
        status={budget.status}
        currency={budget.currency}
        items={budget.items}
        canManage={canManage}
      />
    </div>
  );
}
