"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { upsertExchangeRate } from "@/features/settings/actions/exchange-rate-actions";
import { syncBnaExchangeRateAction } from "@/features/settings/actions/sync-bna-rate-action";
import type { ExchangeRateView } from "@/features/settings/queries/exchange-rates";
import { DateInput } from "@/components/ui/date-input";

type ExchangeRateFormProps = {
  enabledCurrencies: string[];
  recentRates: ExchangeRateView[];
  latestUsdArs: ExchangeRateView | null;
};

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function ExchangeRateForm({
  enabledCurrencies,
  recentRates,
  latestUsdArs,
}: ExchangeRateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncing, startSync] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("ARS");
  const [rate, setRate] = useState(latestUsdArs?.rate?.toString() ?? "");
  const [effectiveAt, setEffectiveAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  const currencies =
    enabledCurrencies.length > 0 ? enabledCurrencies : ["ARS", "USD"];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await upsertExchangeRate({
        fromCurrency,
        toCurrency,
        rate: Number(rate),
        effectiveAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Cotización manual guardada.");
      router.refresh();
    });
  }

  function onSyncBna() {
    setError(null);
    setMessage(null);
    startSync(async () => {
      const result = await syncBnaExchangeRateAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRate(String(result.rate));
      setEffectiveAt(result.effectiveAt);
      setMessage(
        result.created
          ? `Registro del día creado: 1 USD = ${result.rate} ARS (BNA venta ${result.sell} / compra ${result.buy}).`
          : `Registro del día actualizado: 1 USD = ${result.rate} ARS (BNA venta ${result.sell} / compra ${result.buy}).`,
      );
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-tight">
            Tipos de cambio
          </h2>
          <p className="text-sm text-muted-foreground">
            Cotización automática del Banco Nación (USD→ARS). Cada día se genera
            un registro nuevo para el histórico.
          </p>
          {latestUsdArs && (
            <p className="mt-2 text-sm">
              Último USD → ARS:{" "}
              <span className="font-medium tabular-nums">
                {latestUsdArs.rate.toLocaleString("es-AR", {
                  maximumFractionDigits: 4,
                })}
              </span>{" "}
              <span className="text-muted-foreground">
                ({latestUsdArs.effectiveAt}
                {latestUsdArs.notes ? ` · ${latestUsdArs.notes}` : ""})
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={onSyncBna}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          <RefreshCw
            className={`size-4 ${syncing ? "animate-spin" : ""}`}
            aria-hidden
          />
          {syncing ? "Consultando BNA…" : "Actualizar desde BNA"}
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">De</span>
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className={fieldClass}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">A</span>
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className={fieldClass}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Cotización</span>
          <input
            type="number"
            min={0}
            step="any"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Ej. 1520"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Vigencia</span>
          <DateInput
            required
            value={effectiveAt}
            onChange={setEffectiveAt}
            className="w-full bg-surface"
          />
        </label>
        <div className="flex items-end sm:col-span-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar cotización manual"}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-success" role="status">
          {message}
        </p>
      )}

      {recentRates.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Histórico reciente</h3>
          <ul className="divide-y divide-border border-y border-border text-sm">
            {recentRates.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  1 {row.fromCurrency} ={" "}
                  <span className="font-medium tabular-nums">
                    {row.rate.toLocaleString("es-AR", {
                      maximumFractionDigits: 6,
                    })}
                  </span>{" "}
                  {row.toCurrency}
                  {row.notes ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {row.notes}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">{row.effectiveAt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
