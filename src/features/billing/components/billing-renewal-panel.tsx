"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BILLING_PLANS,
  BILLING_TIERS,
  type BillingTierId,
  type PaidBillingPlanId,
} from "@/features/billing/lib/plans";
import {
  createMercadoPagoRenewalIntent,
  submitTransferRenewal,
} from "@/features/billing/actions/billing-actions";
import type { TransferBankDetails } from "@/features/billing/lib/transfer-config";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type BillingRenewalPanelProps = {
  usdArsRate: number | null;
  bank: TransferBankDetails;
  mpConfigured: boolean;
};

export function BillingRenewalPanel({
  usdArsRate,
  bank,
  mpConfigured,
}: BillingRenewalPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tier, setTier] = useState<BillingTierId>("TEAM");
  const [cycle, setCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [method, setMethod] = useState<"MERCADOPAGO" | "TRANSFER">(
    mpConfigured ? "MERCADOPAGO" : "TRANSFER",
  );
  const [currency, setCurrency] = useState<"USD" | "ARS">("USD");
  const [proof, setProof] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const plan: PaidBillingPlanId =
    cycle === "MONTHLY"
      ? BILLING_TIERS[tier].monthly
      : BILLING_TIERS[tier].annual;
  const priceUsd = BILLING_PLANS[plan].priceUsd;
  const amountArs = usdArsRate
    ? Math.round(priceUsd * usdArsRate * 100) / 100
    : null;

  function onFile(file: File | null) {
    if (!file) return setProof(null);
    const reader = new FileReader();
    reader.onload = () => setProof(String(reader.result));
    reader.readAsDataURL(file);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (method === "MERCADOPAGO") {
        const result = await createMercadoPagoRenewalIntent({ plan });
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
        setError("Subí el comprobante.");
        return;
      }
      const result = await submitTransferRenewal({
        plan,
        currency,
        proofDataUrl: proof,
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
      <p className="rounded-md border border-border bg-surface p-4 text-sm">
        Comprobante enviado. Cuando se apruebe, se extenderá tu acceso.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border p-4"
    >
      <h2 className="font-display text-lg">Renovar acceso</h2>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Nivel</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BILLING_TIERS) as BillingTierId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                tier === t ? "border-accent bg-accent/10" : "border-border",
              )}
            >
              {BILLING_TIERS[t].label} · {BILLING_TIERS[t].usersLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Periodo</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCycle("MONTHLY")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              cycle === "MONTHLY" ? "border-accent bg-accent/10" : "border-border",
            )}
          >
            Mensual · USD {BILLING_PLANS[BILLING_TIERS[tier].monthly].priceUsd}
          </button>
          <button
            type="button"
            onClick={() => setCycle("ANNUAL")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              cycle === "ANNUAL" ? "border-accent bg-accent/10" : "border-border",
            )}
          >
            Anual · USD {BILLING_PLANS[BILLING_TIERS[tier].annual].priceUsd}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {mpConfigured && (
          <button
            type="button"
            onClick={() => setMethod("MERCADOPAGO")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
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
            "rounded-md border px-3 py-1.5 text-sm",
            method === "TRANSFER" ? "border-accent bg-accent/10" : "border-border",
          )}
        >
          Transferencia
        </button>
      </div>

      {method === "TRANSFER" && (
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={cn(
                "rounded-md border px-2 py-1",
                currency === "USD" ? "border-accent" : "border-border",
              )}
            >
              USD {priceUsd}
            </button>
            <button
              type="button"
              onClick={() => setCurrency("ARS")}
              disabled={!amountArs}
              className={cn(
                "rounded-md border px-2 py-1 disabled:opacity-50",
                currency === "ARS" ? "border-accent" : "border-border",
              )}
            >
              ARS {amountArs?.toLocaleString("es-AR") ?? "—"}
            </button>
          </div>
          <p className="text-muted-foreground">
            {currency === "ARS"
              ? `${bank.bankNameArs} · CBU ${bank.cbuArs} · Alias ${bank.aliasArs}`
              : `${bank.bankNameUsd} · ${bank.accountUsd}`}
          </p>
          <input
            type="file"
            accept="image/*,application/pdf"
            required
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className={fieldClass}
          />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending
          ? "Procesando…"
          : method === "MERCADOPAGO"
            ? "Pagar"
            : "Enviar"}
      </button>
    </form>
  );
}
