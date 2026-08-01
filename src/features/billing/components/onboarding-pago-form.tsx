"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Upload } from "lucide-react";
import {
  BILLING_PLANS,
  type BillingPlanId,
  planIsMonthlyCycle,
  formatPlanUsersLabel,
} from "@/features/billing/lib/plans";
import {
  createMercadoPagoSignupIntent,
  startTrialSignup,
  submitTransferSignup,
} from "@/features/billing/actions/billing-actions";
import type { TransferBankDetails } from "@/features/billing/lib/platform-billing-settings";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

function formatMoney(currency: string, amount: number) {
  if (amount <= 0) return "Gratis";
  return `${currency} ${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export type CheckoutPriceQuote = {
  currency: "USD" | "ARS";
  amount: number;
  baseAmount?: number;
  surchargePercent?: number;
};

type OnboardingPagoFormProps = {
  plan: BillingPlanId;
  transferQuote: CheckoutPriceQuote;
  mpQuote: CheckoutPriceQuote;
  /** Si el plan base es USD, permite pagar transferencia en ARS al TC. */
  transferArsFromUsd: number | null;
  usdArsRate: number | null;
  bank: TransferBankDetails;
  mpConfigured: boolean;
  /** Si falta, se pide en el formulario de pago. */
  initialPhone?: string | null;
};

export function OnboardingPagoForm({
  plan,
  transferQuote,
  mpQuote,
  transferArsFromUsd,
  usdArsRate,
  bank,
  mpConfigured,
  initialPhone = null,
}: OnboardingPagoFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<"MERCADOPAGO" | "TRANSFER">(
    mpConfigured ? "MERCADOPAGO" : "TRANSFER",
  );
  const [currency, setCurrency] = useState<"USD" | "ARS">(
    transferQuote.currency,
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState<string | null>(null);

  const planDef = BILLING_PLANS[plan];
  const fixedArsPlan = transferQuote.currency === "ARS";
  const isFree = transferQuote.amount <= 0 && mpQuote.amount <= 0;

  const transferAmountLabel = useMemo(() => {
    if (fixedArsPlan || currency === "USD") {
      return formatMoney(
        fixedArsPlan ? "ARS" : "USD",
        fixedArsPlan ? transferQuote.amount : transferQuote.amount,
      );
    }
    return transferArsFromUsd != null
      ? formatMoney("ARS", transferArsFromUsd)
      : "ARS —";
  }, [fixedArsPlan, currency, transferQuote, transferArsFromUsd]);

  const mpAmountLabel = formatMoney(mpQuote.currency, mpQuote.amount);

  function onFile(file: File | null) {
    if (!file) {
      setProof(null);
      setProofFileName(null);
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setError("El archivo no puede superar 2.5 MB.");
      setProof(null);
      setProofFileName(null);
      return;
    }
    setError(null);
    setProofFileName(file.name);
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
    const phone = String(fd.get("phone") ?? "") || undefined;

    startTransition(async () => {
      if (isFree) {
        const result = await startTrialSignup({
          companyName,
          companySlug,
          phone,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        window.location.href = "/";
        return;
      }

      if (method === "MERCADOPAGO") {
        if (!mpConfigured) {
          setError("Mercado Pago no está configurado.");
          return;
        }
        const result = await createMercadoPagoSignupIntent({
          plan,
          companyName,
          companySlug,
          phone,
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
        currency: fixedArsPlan ? "ARS" : currency,
        companyName,
        companySlug,
        proofDataUrl: proof,
        notes,
        phone,
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
          Vamos a revisar la transferencia y activar tu empresa. Te avisamos
          por email o WhatsApp cuando se acepte o rechace, con el motivo. Te
          quedará habilitada por{" "}
          {planIsMonthlyCycle(plan) ? "el período del plan" : "1 año"} una vez
          aprobada.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Plan seleccionado</p>
        <p className="font-display text-xl">{planDef.label}</p>
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
          <input
            name="companySlug"
            className={fieldClass}
            placeholder="mi-constructora"
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Teléfono celular</span>
          <input
            type="tel"
            name="phone"
            required={!initialPhone}
            defaultValue={initialPhone ?? ""}
            autoComplete="tel"
            inputMode="tel"
            placeholder="11 5555-5555"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Te avisamos por WhatsApp o email si el pago fue aceptado o
            rechazado.
          </span>
        </label>
      </div>

      {isFree ? (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
          Este plan está en <span className="font-medium text-foreground">Gratis</span>{" "}
          según los precios de administración. Completá los datos y activá sin
          pago.
        </p>
      ) : (
      <div className="space-y-2">
        <p className="text-sm font-medium">¿Cómo querés pagar?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {mpConfigured && (
            <button
              type="button"
              onClick={() => setMethod("MERCADOPAGO")}
              className={cn(
                "rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors",
                method === "MERCADOPAGO"
                  ? "border-accent bg-background ring-1 ring-accent"
                  : "border-border hover:bg-surface",
              )}
            >
              <p className="font-medium text-foreground">Mercado Pago</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                {mpAmountLabel}
              </p>
              {(mpQuote.surchargePercent ?? 0) > 0 && (
                <p className="mt-1 text-xs text-foreground/65">
                  Incluye +{mpQuote.surchargePercent}% de recargo (
                  {formatMoney(
                    mpQuote.currency,
                    mpQuote.baseAmount ?? mpQuote.amount,
                  )}{" "}
                  + recargo)
                </p>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMethod("TRANSFER")}
            className={cn(
              "rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors",
              method === "TRANSFER"
                ? "border-accent bg-background ring-1 ring-accent"
                : "border-border hover:bg-surface",
              !mpConfigured && "sm:col-span-2",
            )}
          >
            <p className="font-medium text-foreground">
              Transferencia bancaria
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              {fixedArsPlan
                ? formatMoney("ARS", transferQuote.amount)
                : formatMoney("USD", transferQuote.amount)}
            </p>
            <p className="mt-1 text-xs text-foreground/65">
              Sin recargo · Alias / CBU configurados por la plataforma
            </p>
          </button>
        </div>
      </div>
      )}

      {!isFree && method === "TRANSFER" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          {!fixedArsPlan && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={cn(
                  "rounded-md border-2 px-3 py-1.5 text-sm font-medium",
                  currency === "USD"
                    ? "border-accent bg-background text-foreground ring-1 ring-accent"
                    : "border-border text-foreground",
                )}
              >
                {formatMoney("USD", transferQuote.amount)}
              </button>
              <button
                type="button"
                onClick={() => setCurrency("ARS")}
                disabled={transferArsFromUsd == null}
                className={cn(
                  "rounded-md border-2 px-3 py-1.5 text-sm font-medium disabled:opacity-50",
                  currency === "ARS"
                    ? "border-accent bg-background text-foreground ring-1 ring-accent"
                    : "border-border text-foreground",
                )}
              >
                {transferArsFromUsd != null
                  ? formatMoney("ARS", transferArsFromUsd)
                  : "ARS —"}
                {usdArsRate ? (
                  <span className="text-foreground/65">
                    {" "}
                    (TC {usdArsRate.toLocaleString("es-AR")})
                  </span>
                ) : null}
              </button>
            </div>
          )}

          <p className="text-sm font-medium">
            Transferí {transferAmountLabel} a:
          </p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Titular:</span>{" "}
              {bank.accountName}
            </p>
            <p>
              <span className="text-muted-foreground">CUIT:</span> {bank.taxId}
            </p>
            {(fixedArsPlan || currency === "ARS") && (
              <>
                <p>
                  <span className="text-muted-foreground">Banco:</span>{" "}
                  {bank.bankNameArs}
                </p>
                <p>
                  <span className="text-muted-foreground">CBU:</span>{" "}
                  {bank.cbuArs}
                </p>
                <p>
                  <span className="text-muted-foreground">Alias:</span>{" "}
                  {bank.aliasArs}
                </p>
              </>
            )}
            {!fixedArsPlan && currency === "USD" && (
              <>
                <p>
                  <span className="text-muted-foreground">Banco USD:</span>{" "}
                  {bank.bankNameUsd}
                </p>
                <p>
                  <span className="text-muted-foreground">Cuenta:</span>{" "}
                  {bank.accountUsd}
                </p>
                <p>
                  <span className="text-muted-foreground">CBU:</span>{" "}
                  {bank.cbuArs}
                </p>
                <p>
                  <span className="text-muted-foreground">Alias:</span>{" "}
                  {bank.aliasArs}
                </p>
              </>
            )}
            <p className="text-muted-foreground">{bank.notes}</p>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Comprobante</span>
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
        disabled={
          pending ||
          (!isFree && method === "MERCADOPAGO" && !mpConfigured)
        }
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending
          ? "Procesando…"
          : isFree
            ? "Activar prueba gratis"
            : method === "MERCADOPAGO"
              ? `Pagar ${mpAmountLabel} con Mercado Pago`
              : "Enviar comprobante"}
      </button>
    </form>
  );
}
