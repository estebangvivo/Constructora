import { formatBudgetMoney } from "@/features/budget/lib/labels";
import type { ProjectListFinancialBrief } from "@/features/projects/queries/list-projects-financial-brief";

/** Semáforo de margen de caja para el listado de obras. */
export function ProjectMarginBadge({
  brief,
}: {
  brief: ProjectListFinancialBrief | undefined;
}) {
  if (!brief) return null;
  const { cashMargin, currency } = brief;
  const tone =
    cashMargin > 0.009
      ? "bg-emerald-100 text-emerald-800"
      : cashMargin < -0.009
        ? "bg-red-100 text-red-800"
        : "bg-muted text-muted-foreground";
  const label =
    cashMargin > 0.009 ? "Gana" : cashMargin < -0.009 ? "Pierde" : "Empate";

  return (
    <div className="min-w-[7.5rem]" title="Margen de caja = cobrado − pagado">
      <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        Margen caja
      </p>
      <span
        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${tone}`}
      >
        <span>{label}</span>
        <span className="tabular-nums">
          {formatBudgetMoney(cashMargin, currency)}
        </span>
      </span>
    </div>
  );
}
