import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  BILLING_PLANS,
  BILLING_TIERS,
  formatPlanPriceLabel,
} from "@/features/billing/lib/plans";
import { prisma } from "@/lib/prisma";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function OnboardingPlanesPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  if (session.organizationId) {
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

  const tiers = Object.values(BILLING_TIERS);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Elegí tu plan</h1>
        <p className="mt-2 text-muted-foreground">
          Empezá con 30 días de prueba ({formatPlanPriceLabel("TRIAL")} vía
          Mercado Pago), o contratá según cuántos usuarios necesitás.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 className="font-display text-xl">{BILLING_PLANS.TRIAL.label}</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {formatPlanPriceLabel("TRIAL")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {BILLING_PLANS.TRIAL.description}
          </p>
        </div>
        <Link
          href="/onboarding/pago?plan=TRIAL"
          className="mt-4 inline-flex shrink-0 justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium sm:mt-0"
        >
          Empezar prueba · {formatPlanPriceLabel("TRIAL")}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => {
          const monthly = BILLING_PLANS[tier.monthly];
          const annual = BILLING_PLANS[tier.annual];
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
                USD {monthly.priceUsd}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / mes
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                o USD {annual.priceUsd} / año
              </p>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">
                {tier.blurb}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href={`/onboarding/pago?plan=${tier.monthly}`}
                  className="inline-flex justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
                >
                  Mensual · USD {monthly.priceUsd}
                </Link>
                <Link
                  href={`/onboarding/pago?plan=${tier.annual}`}
                  className="inline-flex justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium"
                >
                  Anual · USD {annual.priceUsd}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
