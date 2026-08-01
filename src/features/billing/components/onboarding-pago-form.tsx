"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BILLING_PLANS,
  type PaidBillingPlanId,
  planIsMonthlyCycle,
  formatPlanUsersLabel,
} from "@/features/billing/lib/plans";
import {
  createMercadoPagoSignupIntent,
  submitTransferSignup,
} from "@/features/billing/actions/billing-actions";
import type { TransferBankDetails } from "@/features/billing/lib/transfer-config";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type OnboardingPagoFormProps = {
  plan: PaidBillingPlanId;
  usdArsRate: number | null;
  bank: TransferBankDetails;
  mpConfigured: boolean;
};

export function OnboardingPagoForm({
  plan,
  usdArsRate,
  bank,
  mpConfigured,
}: OnboardingPagoFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<"MERCADOPAGO" | "TRANSFER">(
    mpConfigured ? "MERCADOPAGO" : "TRANSFER",
  );
  const [currency, setCurrency] = useState<"USD" | "ARS">("USD");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [proof, setProof] = useState<string | null>(null);

  const planDef = BILLING_PLANS[plan];
  const amountArs = useMemo(() => {
    if (!usdArsRate) return null;
    return Math.round(planDef.priceUsd * usdArsRate * 100) / 100;
  }, [planDef.priceUsd, usdArsRate]);

  function onFile(file: File | null) {
    if (!file) {
      setProof(null);
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setError("El archivo no puede superar 2.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProof(String(reader.result));
    reader.readAsDataURL(file);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const companyName = String(fd.get("companyName") ?? "");
    const companySlug = String(fd.get("companySlug") ?? "") || undefined;
    const notes = String(fd.get("notes") ?? "") || undefined;

    startTransition(async () => {
      if (method === "MERCADOPAGO") {
        const result = await createMercadoPagoSignupIntent({
          plan,
          companyName,
          companySlug,
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
        return;
      }

      if (!proof) {
        setError("Subí el comprobante de transferencia.");
        return;
      }
      const result = await submitTransferSignup({
        plan,
        currency,
        companyName,
        companySlug,
        proofDataUrl: proof,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-xl">Comprobante recibido</h2>
        <p className="text-sm text-muted-foreground">
          Vamos a revisar la transferencia y activar tu empresa. Te quedará
          habilitada por{" "}
          {planIsMonthlyCycle(plan) ? "1 mes" : "1 año"} una vez aprobada.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Plan seleccionado</p>
        <p className="font-display text-xl">
          {planDef.label} — USD {planDef.priceUsd}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatPlanUsersLabel(planDef.maxUsers)} · {planDef.description}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Nombre de la empresa</span>
          <input name="companyName" required className={fieldClass} />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">
            Identificador (slug, opcional)
          </span>
          <input name="companySlug" className={fieldClass} placeholder="mi-constructora" />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Método de pago</p>
        <div className="flex flex-wrap gap-2">
          {mpConfigured && (
            <button
              type="button"
              onClick={() => setMethod("MERCADOPAGO")}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                method === "MERCADOPAGO"
                  ? "border-accent bg-accent/10"
                  : "border-border",
              )}
            >
              Mercado Pago
            </button>
          )}
          <button
            type="button"
            onClick={() => setMethod("TRANSFER")}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              method === "TRANSFER"
                ? "border-accent bg-accent/10"
                : "border-border",
            )}
          >
            Transferencia bancaria
          </button>
        </div>
      </div>

      {method === "TRANSFER" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                currency === "USD" ? "border-accent bg-accent/10" : "border-border",
              )}
            >
              USD {planDef.priceUsd}
            </button>
            <button
              type="button"
              onClick={() => setCurrency("ARS")}
              disabled={!amountArs}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm disabled:opacity-50",
                currency === "ARS" ? "border-accent bg-accent/10" : "border-border",
              )}
            >
              ARS {amountArs ? amountArs.toLocaleString("es-AR") : "—"}
              {usdArsRate ? (
                <span className="text-muted-foreground">
                  {" "}
                  (TC {usdArsRate.toLocaleString("es-AR")})
                </span>
              ) : null}
            </button>
          </div>

          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Titular:</span>{" "}
              {bank.accountName}
            </p>
            <p>
              <span className="text-muted-foreground">CUIT:</span> {bank.taxId}
            </p>
            {currency === "ARS" ? (
              <>
                <p>
                  <span className="text-muted-foreground">Banco:</span>{" "}
                  {bank.bankNameArs}
                </p>
                <p>
                  <span className="text-muted-foreground">CBU:</span> {bank.cbuArs}
                </p>
                <p>
                  <span className="text-muted-foreground">Alias:</span>{" "}
                  {bank.aliasArs}
                </p>
              </>
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground">Banco USD:</span>{" "}
                  {bank.bankNameUsd}
                </p>
                <p>
                  <span className="text-muted-foreground">Cuenta:</span>{" "}
                  {bank.accountUsd}
                </p>
              </>
            )}
            <p className="text-muted-foreground">{bank.notes}</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Comprobante</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              required
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notas (opcional)</span>
            <textarea name="notes" rows={2} className={fieldClass} />
          </label>
        </div>
      )}

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
        {pending
          ? "Procesando…"
          : method === "MERCADOPAGO"
            ? "Ir a Mercado Pago"
            : "Enviar comprobante"}
      </button>
    </form>
  );
}
