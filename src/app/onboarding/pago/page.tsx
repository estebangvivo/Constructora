import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  BILLING_PLANS,
  isPaidBillingPlan,
  normalizeBillingPlanId,
  type BillingPlanId,
} from "@/features/billing/lib/plans";
import {
  planCheckoutChargeEffective,
  planMercadoPagoChargeEffective,
} from "@/features/billing/lib/effective-plans";
import { getBillingUsdArsRate } from "@/features/billing/lib/fx";
import {
  getTransferBankDetailsEffective,
  isMercadoPagoConfigured,
} from "@/features/billing/lib/platform-billing-settings";
import { OnboardingPagoForm } from "@/features/billing/components/onboarding-pago-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; mp?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.organizationId) redirect("/billing");

  const sp = await searchParams;
  const planRaw = sp.plan ?? "TEAM_MONTHLY";
  const normalized = normalizeBillingPlanId(planRaw);
  const plan: BillingPlanId =
    normalized && (normalized === "TRIAL" || isPaidBillingPlan(normalized))
      ? normalized
      : isPaidBillingPlan(planRaw)
        ? planRaw
        : "TEAM_MONTHLY";

  const [usdArsRate, bank, mpConfigured, transferQuote, mpQuote] =
    await Promise.all([
      getBillingUsdArsRate(),
      getTransferBankDetailsEffective(),
      isMercadoPagoConfigured(),
      planCheckoutChargeEffective(plan),
      planMercadoPagoChargeEffective(plan),
    ]);

  const transferArsFromUsd =
    transferQuote.currency === "USD" && usdArsRate
      ? Math.round(transferQuote.amount * usdArsRate * 100) / 100
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/onboarding/planes"
          className="text-sm text-accent hover:underline"
        >
          ← Volver a planes
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          Pago — {BILLING_PLANS[plan].label}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {transferQuote.amount <= 0
            ? "Completá los datos de tu empresa para activar la prueba."
            : "Elegí Mercado Pago o transferencia bancaria y completá los datos de tu empresa."}
        </p>
        {sp.mp === "failure" && (
          <p className="mt-3 rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">
            El pago en Mercado Pago no se completó. Podés reintentar o usar
            transferencia.
          </p>
        )}
      </div>

      <OnboardingPagoForm
        plan={plan}
        transferQuote={transferQuote}
        mpQuote={mpQuote}
        transferArsFromUsd={transferArsFromUsd}
        usdArsRate={usdArsRate}
        bank={bank}
        mpConfigured={mpConfigured}
        initialPhone={session.user.phone}
      />
    </div>
  );
}
