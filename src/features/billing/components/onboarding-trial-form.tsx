"use client";

import { useState, useTransition } from "react";
import {
  BILLING_PLANS,
  formatPlanPriceLabel,
} from "@/features/billing/lib/plans";
import { createMercadoPagoSignupIntent } from "@/features/billing/actions/billing-actions";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function OnboardingTrialForm({
  mpConfigured,
}: {
  mpConfigured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const priceLabel = formatPlanPriceLabel("TRIAL");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!mpConfigured) {
      setError(
        "Mercado Pago no está configurado. Pedile al administrador que cargue el Access Token.",
      );
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createMercadoPagoSignupIntent({
        plan: "TRIAL",
        companyName: String(fd.get("companyName") ?? ""),
        companySlug: String(fd.get("companySlug") ?? "") || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.initPoint) {
        window.location.href = result.initPoint;
        return;
      }
      setError("No se obtuvo el link de Mercado Pago.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="font-display text-xl">
          {BILLING_PLANS.TRIAL.label} — {priceLabel}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {BILLING_PLANS.TRIAL.description}
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nombre de la empresa</span>
        <input name="companyName" required className={fieldClass} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Identificador (opcional)</span>
        <input
          name="companySlug"
          className={fieldClass}
          placeholder="mi-constructora"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !mpConfigured}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending
          ? "Redirigiendo…"
          : `Pagar ${priceLabel} con Mercado Pago`}
      </button>
    </form>
  );
}
