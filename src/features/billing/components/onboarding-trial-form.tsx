"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startTrialSignup } from "@/features/billing/actions/billing-actions";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function OnboardingTrialForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await startTrialSignup({
        companyName: String(fd.get("companyName") ?? ""),
        companySlug: String(fd.get("companySlug") ?? "") || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="font-display text-xl">Prueba 30 días — gratis</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Creá tu empresa y usá el sistema completo. Al vencer tendrás que elegir
          un plan de pago.
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
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Creando…" : "Empezar prueba gratis"}
      </button>
    </form>
  );
}
