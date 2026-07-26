import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getChecksDueAlert } from "@/features/treasury/queries/list-checks";
import { formatMoney } from "@/features/treasury/lib/labels";
import { formatDateAR } from "@/lib/format-date";

function daysLabel(days: number): string {
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? "vencido hace 1 día" : `vencido hace ${n} días`;
  }
  if (days === 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  return `vence en ${days} días`;
}

/** Banner global: cheques en cartera vencidos o por vencer. */
export async function ChecksDueAlertBanner() {
  const alert = await getChecksDueAlert();
  if (alert.total === 0) return null;

  const preview = [...alert.overdue, ...alert.dueSoon].slice(0, 3);
  const remaining = alert.total - preview.length;

  return (
    <div
      role="status"
      className="sticky top-0 z-30 border-b border-danger/40 bg-danger/15 px-4 py-3 text-foreground lg:px-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-2.5">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-danger"
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {alert.overdue.length > 0 && alert.dueSoon.length > 0
                ? `${alert.overdue.length} cheque${alert.overdue.length === 1 ? "" : "s"} vencido${alert.overdue.length === 1 ? "" : "s"} y ${alert.dueSoon.length} por vencer`
                : alert.overdue.length > 0
                  ? `${alert.overdue.length} cheque${alert.overdue.length === 1 ? "" : "s"} vencido${alert.overdue.length === 1 ? "" : "s"} en cartera`
                  : `${alert.dueSoon.length} cheque${alert.dueSoon.length === 1 ? "" : "s"} por vencer en los próximos ${alert.alertDays} día${alert.alertDays === 1 ? "" : "s"}`}
            </p>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {preview.map((c) => (
                <li key={c.id}>
                  <span className="font-medium text-foreground">
                    {c.number}
                  </span>
                  {" · "}
                  {c.bank}
                  {" · "}
                  {formatMoney(c.amount, c.currency)}
                  {" · "}
                  <span
                    className={
                      c.daysUntilDue < 0 ? "font-medium text-danger" : undefined
                    }
                  >
                    {daysLabel(c.daysUntilDue)}
                  </span>
                  {" · vto "}
                  {formatDateAR(c.dueDate)}
                </li>
              ))}
              {remaining > 0 && (
                <li>y {remaining} más…</li>
              )}
            </ul>
          </div>
        </div>
        <Link
          href="/treasury/checks"
          className="shrink-0 self-start rounded-md border border-danger/50 bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface"
        >
          Ver cheques
        </Link>
      </div>
    </div>
  );
}
