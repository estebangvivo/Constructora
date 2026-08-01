import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BILLING_PLANS, BILLING_TIERS } from "@/features/billing/lib/plans";
import {
  formatChargeLabel,
  getEffectivePlanPrices,
  planCheckoutChargeEffective,
} from "@/features/billing/lib/effective-plans";
import { prisma } from "@/lib/prisma";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { MercadoPagoReturnSync } from "@/features/billing/components/mercadopago-return-sync";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    mp?: string;
    payment_id?: string;
    collection_id?: string;
    external_reference?: string;
    status?: string;
    preference_id?: string;
  }>;
};

export default async function OnboardingPlanesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const sp = (await searchParams) ?? {};
  const mpReturn = sp.mp === "success" || Boolean(sp.payment_id || sp.collection_id);

  if (session.organizationId && !mpReturn) {
    if (isPlatformSuperadmin(session)) {
      redirect("/");
    }
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { billingStatus: true, paidUntil: true },
    });
    if (org && organizationHasAppAccess(org)) {
      redirect("/");
    }
    redirect("/billing");
  }

  const [prices, trialCharge] = await Promise.all([
    getEffectivePlanPrices(),
    planCheckoutChargeEffective("TRIAL"),
  ]);
  const trialLabel = formatChargeLabel(trialCharge);
  const trialIsFree = trialCharge.amount <= 0;
  const tiers = Object.values(BILLING_TIERS);

  function planAmountLabel(planId: keyof typeof prices): string {
    const row = prices[planId];
    if (row.priceArs != null) {
      if (row.priceArs <= 0) return "Gratis";
      return `$ ${row.priceArs.toLocaleString("es-AR")} ARS`;
    }
    return `USD ${row.priceUsd}`;
  }

  return (
    <div className="space-y-8">
      {mpReturn && (
        <MercadoPagoReturnSync
          paymentId={sp.payment_id}
          collectionId={sp.collection_id}
          externalReference={sp.external_reference}
          status={sp.status}
          preferenceId={sp.preference_id}
          successHref="/"
        />
      )}
      <div>
        <h1 className="font-display text-3xl tracking-tight">Elegí tu plan</h1>
        <p className="mt-2 text-muted-foreground">
          {trialIsFree
            ? "Empezá con 30 días de prueba gratis, o contratá según cuántos usuarios necesitás."
            : `Empezá con 30 días de prueba (${trialLabel}), o contratá según cuántos usuarios necesitás.`}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 className="font-display text-xl">{BILLING_PLANS.TRIAL.label}</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {trialLabel}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {BILLING_PLANS.TRIAL.description}
            {!trialIsFree
              ? ` Costo de prueba: ${trialLabel}.`
              : null}
          </p>
        </div>
        <Link
          href="/onboarding/pago?plan=TRIAL"
          className="mt-4 inline-flex shrink-0 justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium sm:mt-0"
        >
          Empezar prueba · {trialLabel}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => {
          const monthlyBtn = planAmountLabel(tier.monthly);
          const annualBtn = planAmountLabel(tier.annual);
          return (
            <div
              key={tier.id}
              className="flex flex-col rounded-lg border border-border bg-surface p-5"
            >
              <h2 className="font-display text-xl">{tier.label}</h2>
              <p className="mt-1 text-sm font-medium text-accent">
                {tier.usersLabel}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {monthlyBtn}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / mes
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                o {annualBtn} / año
              </p>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">
                {tier.blurb}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href={`/onboarding/pago?plan=${tier.monthly}`}
                  className="inline-flex justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
                >
                  Mensual · {monthlyBtn}
                </Link>
                <Link
                  href={`/onboarding/pago?plan=${tier.annual}`}
                  className="inline-flex justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium"
                >
                  Anual · {annualBtn}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
