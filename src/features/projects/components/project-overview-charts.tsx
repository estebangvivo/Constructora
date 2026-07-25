import { formatBudgetMoney } from "@/features/budget/lib/labels";

type CompareBar = {
  label: string;
  value: number;
  color: string;
};

type ProjectOverviewChartsProps = {
  currency: string;
  scheduleProgressPct: number;
  budgetEstimated: number;
  cobrado: number;
  pagado: number;
};

function clampPct(n: number) {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function ProgressRing({ pct }: { pct: number }) {
  const value = clampPct(pct);
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <p className="absolute inset-0 flex items-center justify-center font-display text-3xl tracking-tight tabular-nums">
          {value}%
        </p>
      </div>
      <p className="text-sm text-muted-foreground">Avance de cronograma</p>
    </div>
  );
}

function CompareChart({
  title,
  subtitle,
  bars,
  currency,
}: {
  title: string;
  subtitle: string;
  bars: CompareBar[];
  currency: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {bars.map((bar) => {
          const width = Math.max(2, Math.round((bar.value / max) * 100));
          return (
            <div key={bar.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{bar.label}</span>
                <span className="font-medium tabular-nums">
                  {formatBudgetMoney(bar.value, currency)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${width}%`, backgroundColor: bar.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {bars.length === 2 && bars[0].value > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {bars[1].label}:{" "}
          {Math.round((bars[1].value / bars[0].value) * 100)}% del{" "}
          {bars[0].label.toLowerCase()}
        </p>
      )}
    </div>
  );
}

export function ProjectOverviewCharts({
  currency,
  scheduleProgressPct,
  budgetEstimated,
  cobrado,
  pagado,
}: ProjectOverviewChartsProps) {
  return (
    <section>
      <h2 className="font-display text-xl tracking-tight">Indicadores</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Progreso de obra y contraste del presupuesto con cobros y pagos.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div className="flex items-center justify-center rounded-md border border-border bg-surface px-4 py-6">
          <ProgressRing pct={scheduleProgressPct} />
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <CompareChart
            title="Cobrado vs presupuestado"
            subtitle={`Moneda ${currency} · recibos imputados`}
            currency={currency}
            bars={[
              {
                label: "Presupuestado",
                value: budgetEstimated,
                color: "var(--accent)",
              },
              {
                label: "Cobrado",
                value: cobrado,
                color: "var(--success)",
              },
            ]}
          />
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <CompareChart
            title="Presupuestado vs pagado"
            subtitle={`Moneda ${currency} · órdenes de pago`}
            currency={currency}
            bars={[
              {
                label: "Presupuestado",
                value: budgetEstimated,
                color: "var(--accent)",
              },
              {
                label: "Pagado",
                value: pagado,
                color: "var(--danger)",
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
