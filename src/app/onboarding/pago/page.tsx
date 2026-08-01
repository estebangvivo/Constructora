import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  BILLING_PLANS,
  isPaidBillingPlan,
  type PaidBillingPlanId,
} from "@/features/billing/lib/plans";
import { getBillingUsdArsRate } from "@/features/billing/lib/fx";
import {
  getTransferBankDetails,
  isMercadoPagoConfigured,
} from "@/features/billing/lib/transfer-config";
import { OnboardingPagoForm } from "@/features/billing/components/onboarding-pago-form";
import { OnboardingTrialForm } from "@/features/billing/components/onboarding-trial-form";

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
  const planRaw = sp.plan;

  if (planRaw === "TRIAL") {
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
            Prueba gratis
          </h1>
        </div>
        <OnboardingTrialForm />
      </div>
    );
  }

  const plan: PaidBillingPlanId = isPaidBillingPlan(planRaw ?? "")
    ? planRaw!
    : "TEAM_MONTHLY";

  const [usdArsRate, bank, mpConfigured] = await Promise.all([
    getBillingUsdArsRate(),
    Promise.resolve(getTransferBankDetails()),
    isMercadoPagoConfigured(),
  ]);

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
          Completá los datos de tu empresa y el método de pago.
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
        usdArsRate={usdArsRate}
        bank={bank}
        mpConfigured={mpConfigured}
      />
    </div>
  );
}
