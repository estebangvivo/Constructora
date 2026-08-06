import { formatBudgetMoney } from "@/features/budget/lib/labels";

type ProjectProfitabilityPanelProps = {
  currency: string;
  budgetEstimated: number | null;
  certifiedNet: number;
  cobrado: number;
  pagado: number;
  receivable: number;
  cashMargin: number;
  fxIncomplete?: boolean;
};

function Metric({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: "good" | "bad" | "neutral";
}) {
  const color =
    emphasize === "good"
      ? "text-emerald-700"
      : emphasize === "bad"
        ? "text-red-700"
        : "";
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl tracking-tight tabular-nums ${color}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Tablero de rentabilidad de la obra (presupuesto → certificado → caja). */
export function ProjectProfitabilityPanel({
  currency,
  budgetEstimated,
  certifiedNet,
  cobrado,
  pagado,
  receivable,
  cashMargin,
  fxIncomplete,
}: ProjectProfitabilityPanelProps) {
  const budget = budgetEstimated && budgetEstimated > 0 ? budgetEstimated : null;
  const certifiedPct =
    budget != null && budget > 0
      ? Math.round((certifiedNet / budget) * 100)
      : null;
  const collectedPct =
    certifiedNet > 0.009
      ? Math.round((cobrado / certifiedNet) * 100)
      : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl tracking-tight">Rentabilidad</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Presupuesto, avance certificado y resultado de caja de la obra.
          {fxIncomplete ? " Algunas conversiones de moneda quedaron incompletas." : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Presupuesto"
          value={budget != null ? formatBudgetMoney(budget, currency) : "—"}
          hint="Estimado contratado"
        />
        <Metric
          label="Certificado"
          value={formatBudgetMoney(certifiedNet, currency)}
          hint={
            certifiedPct != null
              ? `${certifiedPct}% del presupuesto`
              : "Presentado / aprobado / liquidado"
          }
        />
        <Metric
          label="Cobrado"
          value={formatBudgetMoney(cobrado, currency)}
          hint={
            collectedPct != null
              ? `${collectedPct}% de lo certificado`
              : "Recibos imputados"
          }
        />
        <Metric
          label="Pagado / costos"
          value={formatBudgetMoney(pagado, currency)}
          hint="Órdenes de pago imputadas"
        />
        <Metric
          label="Por cobrar"
          value={formatBudgetMoney(receivable, currency)}
          hint="Certificado − cobrado"
          emphasize={receivable > 0.009 ? "bad" : receivable < -0.009 ? "good" : "neutral"}
        />
        <Metric
          label="Margen de caja"
          value={formatBudgetMoney(cashMargin, currency)}
          hint="Cobrado − pagado"
          emphasize={cashMargin >= 0 ? "good" : "bad"}
        />
      </div>
    </section>
  );
}
