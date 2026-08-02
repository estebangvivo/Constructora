"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Upload } from "lucide-react";
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
import type { TransferBankDetails } from "@/features/billing/lib/platform-billing-settings";
import { PlanSpecialDiscountBadge } from "@/features/billing/components/plan-special-discount-badge";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

function formatMoney(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export type RenewalPlanPrice = {
  priceUsd: number;
  listPriceUsd: number;
  discountPercent: number | null;
  discountUntil: string | null;
  discountPromoMonths: number | null;
  discountSource?: "none" | "campaign" | "org";
};

type BillingRenewalPanelProps = {
  usdArsRate: number | null;
  bank: TransferBankDetails;
  mpConfigured: boolean;
  priceUsdByPlan: Partial<Record<PaidBillingPlanId, number>>;
  planPricesById?: Partial<Record<PaidBillingPlanId, RenewalPlanPrice>>;
  mpSurchargePercent: number;
  heading?: string;
  description?: string;
};

export function BillingRenewalPanel({
  usdArsRate,
  bank,
  mpConfigured,
  priceUsdByPlan,
  planPricesById,
  mpSurchargePercent,
  heading = "Renovar acceso",
  description,
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
  const [proofFileName, setProofFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const plan: PaidBillingPlanId =
    cycle === "MONTHLY"
      ? BILLING_TIERS[tier].monthly
      : BILLING_TIERS[tier].annual;
  const planMeta = planPricesById?.[plan];
  const priceUsd =
    planMeta?.priceUsd ??
    priceUsdByPlan[plan] ??
    BILLING_PLANS[plan].priceUsd;
  const listPriceUsd = planMeta?.listPriceUsd ?? priceUsd;
  const hasDiscount =
    planMeta?.discountPercent != null && planMeta.discountPercent > 0;
  const amountArs = usdArsRate
    ? Math.round(priceUsd * usdArsRate * 100) / 100
    : null;
  const mpAmount =
    Math.round(priceUsd * (1 + mpSurchargePercent / 100) * 100) / 100;

  function planPriceLabel(planId: PaidBillingPlanId) {
    const meta = planPricesById?.[planId];
    const amount =
      meta?.priceUsd ??
      priceUsdByPlan[planId] ??
      BILLING_PLANS[planId].priceUsd;
    return formatMoney("USD", amount);
  }

  function onFile(file: File | null) {
    if (!file) {
      setProof(null);
      setProofFileName(null);
      return;
    }
    setProofFileName(file.name);
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
      <div>
        <h2 className="font-display text-lg">{heading}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {hasDiscount && planMeta?.discountSource === "org" ? (
        <div className="rounded-md border border-amber-700/35 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950">
          <p className="font-semibold tracking-tight">
            Descuento especial activo · {planMeta.discountPercent}% OFF
          </p>
          <p className="mt-0.5 opacity-90">
            Tu promo de plan mensual sigue vigente. Cuando termine, la
            renovación vuelve al precio completo.
          </p>
        </div>
      ) : null}
      {hasDiscount && planMeta?.discountSource !== "org" ? (
        <PlanSpecialDiscountBadge
          discountPercent={planMeta?.discountPercent}
          discountUntil={planMeta?.discountUntil}
          discountPromoMonths={planMeta?.discountPromoMonths}
        />
      ) : null}

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
              cycle === "MONTHLY"
                ? "border-accent bg-accent/10"
                : "border-border",
            )}
          >
            Mensual · {planPriceLabel(BILLING_TIERS[tier].monthly)}
          </button>
          <button
            type="button"
            onClick={() => setCycle("ANNUAL")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              cycle === "ANNUAL"
                ? "border-accent bg-accent/10"
                : "border-border",
            )}
          >
            Anual · {planPriceLabel(BILLING_TIERS[tier].annual)}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">¿Cómo querés pagar?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {mpConfigured && (
            <button
              type="button"
              onClick={() => setMethod("MERCADOPAGO")}
              className={cn(
                "rounded-lg border-2 px-4 py-3 text-left text-sm",
                method === "MERCADOPAGO"
                  ? "border-accent bg-background ring-1 ring-accent"
                  : "border-border",
              )}
            >
              <p className="font-medium text-foreground">Mercado Pago</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {hasDiscount && listPriceUsd !== priceUsd ? (
                  <span className="mr-2 text-sm font-normal text-muted-foreground line-through">
                    {formatMoney(
                      "USD",
                      Math.round(
                        listPriceUsd * (1 + mpSurchargePercent / 100) * 100,
                      ) / 100,
                    )}
                  </span>
                ) : null}
                {formatMoney("USD", mpAmount)}
              </p>
              {mpSurchargePercent > 0 && (
                <p className="mt-1 text-xs text-foreground/65">
                  Incluye +{mpSurchargePercent}% de recargo
                </p>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMethod("TRANSFER")}
            className={cn(
              "rounded-lg border-2 px-4 py-3 text-left text-sm",
              method === "TRANSFER"
                ? "border-accent bg-background ring-1 ring-accent"
                : "border-border",
              !mpConfigured && "sm:col-span-2",
            )}
          >
            <p className="font-medium text-foreground">
              Transferencia bancaria
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {hasDiscount && listPriceUsd !== priceUsd ? (
                <span className="mr-2 text-sm font-normal text-muted-foreground line-through">
                  {formatMoney("USD", listPriceUsd)}
                </span>
              ) : null}
              {formatMoney("USD", priceUsd)}
            </p>
            <p className="mt-1 text-xs text-foreground/65">Sin recargo</p>
          </button>
        </div>
      </div>

      {method === "TRANSFER" && (
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={cn(
                "rounded-md border-2 px-2 py-1 font-medium",
                currency === "USD"
                  ? "border-accent bg-background text-foreground ring-1 ring-accent"
                  : "border-border text-foreground",
              )}
            >
              {formatMoney("USD", priceUsd)}
            </button>
            <button
              type="button"
              onClick={() => setCurrency("ARS")}
              disabled={!amountArs}
              className={cn(
                "rounded-md border-2 px-2 py-1 font-medium disabled:opacity-50",
                currency === "ARS"
                  ? "border-accent bg-background text-foreground ring-1 ring-accent"
                  : "border-border text-foreground",
              )}
            >
              {amountArs != null ? formatMoney("ARS", amountArs) : "ARS —"}
            </button>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <p>
              Titular: {bank.accountName} · CUIT {bank.taxId}
            </p>
            {currency === "ARS" ? (
              <p>
                {bank.bankNameArs} · CBU {bank.cbuArs} · Alias {bank.aliasArs}
              </p>
            ) : (
              <p>
                {bank.bankNameUsd} · {bank.accountUsd} · CBU {bank.cbuArs} ·
                Alias {bank.aliasArs}
              </p>
            )}
            <p>{bank.notes}</p>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">
              Comprobante
            </span>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-3 transition-colors hover:border-foreground/30 hover:bg-surface",
                proof && "border-emerald-700/40 bg-emerald-50",
              )}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                required
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground">
                {proof ? (
                  <CheckCircle2
                    className="size-4 text-emerald-700"
                    aria-hidden
                  />
                ) : (
                  <Upload className="size-4" aria-hidden />
                )}
                {proof ? "Cambiar" : "Elegir archivo"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {proofFileName ?? "PDF o imagen · máx. 2.5 MB"}
              </span>
            </label>
          </div>
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
            ? `Pagar ${formatMoney("USD", mpAmount)}`
            : "Enviar comprobante"}
      </button>
    </form>
  );
}
