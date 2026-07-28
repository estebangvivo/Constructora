import Link from "next/link";
import { formatMoneyByCurrency } from "@/config/currencies";
import { formatDateAR } from "@/lib/format-date";
import { formatMoney } from "@/features/treasury/lib/labels";
import { formatCashMoney } from "@/features/treasury/lib/cash-labels";
import type { HomeDashboardData } from "@/features/dashboard/queries/get-home-dashboard";

type HomeDashboardProps = {
  data: HomeDashboardData;
};

export function HomeDashboard({ data }: HomeDashboardProps) {
  if (!data.showTreasury && !data.showProjects) return null;

  return (
    <section className="mb-10 space-y-8" aria-label="Resumen del negocio">
      {data.showTreasury ? (
        <>
          <div>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg tracking-tight">
                Movimientos · {data.periodLabel}
              </h2>
              <p className="text-xs text-muted-foreground">
                Solo documentos imputados (POSTED)
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="border-l-2 border-success pl-3">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Cobros
                </dt>
                <dd className="mt-1 font-display text-xl">
                  {formatMoneyByCurrency(data.incomePosted)}
                </dd>
                {data.incomeDeltaLabel ? (
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {data.incomeDeltaLabel}
                  </dd>
                ) : null}
              </div>
              <div className="border-l-2 border-danger pl-3">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Gastos
                </dt>
                <dd className="mt-1 font-display text-xl">
                  {formatMoneyByCurrency(data.expensePosted)}
                </dd>
                {data.expenseDeltaLabel ? (
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {data.expenseDeltaLabel}
                  </dd>
                ) : null}
              </div>
              <div className="border-l-2 border-accent pl-3">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Neto del mes
                </dt>
                <dd className="mt-1 font-display text-xl">
                  {formatMoneyByCurrency(data.netPosted)}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  Cobros − gastos
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg tracking-tight">
                  Liquidez
                </h2>
                <Link
                  href="/treasury/cash"
                  className="text-xs text-accent hover:underline"
                >
                  Ver caja
                </Link>
              </div>
              <dl className="space-y-3 border-l-2 border-border pl-3">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Caja diaria
                  </dt>
                  <dd className="mt-0.5 font-display text-lg">
                    {data.cashDailyBalance != null
                      ? formatCashMoney(
                          data.cashDailyBalance,
                          data.cashCurrency,
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Tesorería
                  </dt>
                  <dd className="mt-0.5 font-display text-lg">
                    {data.cashTreasuryBalance != null
                      ? formatCashMoney(
                          data.cashTreasuryBalance,
                          data.cashCurrency,
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Bancos
                  </dt>
                  <dd className="mt-0.5 font-display text-lg">
                    {formatMoneyByCurrency(data.bankTotals)}
                  </dd>
                  <dd className="mt-1">
                    <Link
                      href="/treasury/banks"
                      className="text-xs text-accent hover:underline"
                    >
                      Ver cuentas
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg tracking-tight">
                  Cheques
                </h2>
                <Link
                  href="/treasury/checks"
                  className="text-xs text-accent hover:underline"
                >
                  Ver cartera
                </Link>
              </div>
              {data.checks && data.checks.total > 0 ? (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    <span className="text-danger">
                      {data.checks.overdue.length} vencido
                      {data.checks.overdue.length === 1 ? "" : "s"}
                    </span>
                    {" · "}
                    <span>
                      {data.checks.dueSoon.length} por vencer (≤{" "}
                      {data.checks.alertDays} días)
                    </span>
                  </p>
                  <ul className="divide-y divide-border border-t border-border">
                    {data.checkPreview.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
                      >
                        <span>
                          <span className="font-medium">#{c.number}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.bank}
                          </span>
                          {c.dueDate ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {formatDateAR(c.dueDate)}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={
                            c.daysUntilDue < 0
                              ? "text-danger"
                              : "text-foreground"
                          }
                        >
                          {formatMoney(c.amount, c.currency)}
                          {c.daysUntilDue < 0
                            ? " · vencido"
                            : c.daysUntilDue === 0
                              ? " · hoy"
                              : ` · ${c.daysUntilDue}d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay cheques vencidos ni por vencer en la ventana
                  configurada.
                </p>
              )}
            </div>
          </div>

          {(data.pendingReceipts > 0 || data.pendingOrders > 0) && (
            <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
              <p className="font-medium">Pendientes de imputar</p>
              <p className="mt-1 text-muted-foreground">
                {data.pendingReceipts > 0 ? (
                  <>
                    <Link
                      href="/treasury/receipts"
                      className="text-accent hover:underline"
                    >
                      {data.pendingReceipts} recibo
                      {data.pendingReceipts === 1 ? "" : "s"}
                    </Link>
                    {data.pendingOrders > 0 ? " · " : null}
                  </>
                ) : null}
                {data.pendingOrders > 0 ? (
                  <Link
                    href="/treasury/payment-orders"
                    className="text-accent hover:underline"
                  >
                    {data.pendingOrders} orden
                    {data.pendingOrders === 1 ? "" : "es"} de pago
                  </Link>
                ) : null}
              </p>
            </div>
          )}
        </>
      ) : null}

      {data.showProjects ? (
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg tracking-tight">Obras</h2>
            <Link
              href="/projects"
              className="text-xs text-accent hover:underline"
            >
              Ver obras
            </Link>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="border-l-2 border-accent pl-3">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Abiertas
              </dt>
              <dd className="mt-1 font-display text-2xl">
                {data.projectsOpen ?? 0}
              </dd>
            </div>
            <div className="border-l-2 border-border pl-3">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Cerradas
              </dt>
              <dd className="mt-1 font-display text-2xl">
                {data.projectsClosed ?? 0}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
