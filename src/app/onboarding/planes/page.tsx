import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BILLING_PLANS, BILLING_TIERS } from "@/features/billing/lib/plans";
import {
  formatChargeLabel,
  getEffectivePlanPrices,
  planCheckoutChargeEffective,
  type EffectivePlanPrice,
} from "@/features/billing/lib/effective-plans";
import { prisma } from "@/lib/prisma";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { MercadoPagoReturnSync } from "@/features/billing/components/mercadopago-return-sync";
import { PlanSpecialDiscountBadge } from "@/features/billing/components/plan-special-discount-badge";

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

function amountLabel(row: EffectivePlanPrice): string {
  if (row.priceArs != null) {
    if (row.priceArs <= 0) return "Gratis";
    return `$ ${row.priceArs.toLocaleString("es-AR")} ARS`;
  }
  return `USD ${row.priceUsd}`;
}

function listAmountLabel(row: EffectivePlanPrice): string | null {
  if (row.discountPercent == null) return null;
  if (row.listPriceArs != null) {
    if (row.listPriceArs <= 0) return "Gratis";
    return `$ ${row.listPriceArs.toLocaleString("es-AR")} ARS`;
  }
  return `USD ${row.listPriceUsd}`;
}

/** Descuento a mostrar en la tarjeta del tier (prioriza mensual, si no anual). */
function tierDiscount(monthly: EffectivePlanPrice, annual: EffectivePlanPrice) {
  if (monthly.discountPercent != null) {
    return {
      percent: monthly.discountPercent,
      until: monthly.discountUntil,
      months: monthly.discountPromoMonths,
    };
  }
  if (annual.discountPercent != null) {
    return {
      percent: annual.discountPercent,
      until: annual.discountUntil,
      months: annual.discountPromoMonths,
    };
  }
  return null;
}

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
  const trialRow = prices.TRIAL;
  const tiers = Object.values(BILLING_TIERS);

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
        <div className="space-y-2">
          <PlanSpecialDiscountBadge
            discountPercent={trialRow.discountPercent}
            discountUntil={trialRow.discountUntil}
            discountPromoMonths={trialRow.discountPromoMonths}
          />
          <h2 className="font-display text-xl">{BILLING_PLANS.TRIAL.label}</h2>
          <p className="text-2xl font-semibold tracking-tight">
            {listAmountLabel(trialRow) ? (
              <>
                <span className="mr-2 text-base font-normal text-muted-foreground line-through">
                  {listAmountLabel(trialRow)}
                </span>
                {trialLabel}
              </>
            ) : (
              trialLabel
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {BILLING_PLANS.TRIAL.description}
            {!trialIsFree ? ` Costo de prueba: ${trialLabel}.` : null}
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
          const monthly = prices[tier.monthly];
          const annual = prices[tier.annual];
          const monthlyBtn = amountLabel(monthly);
          const annualBtn = amountLabel(annual);
          const monthlyList = listAmountLabel(monthly);
          const annualList = listAmountLabel(annual);
          const discount = tierDiscount(monthly, annual);
          return (
            <div
              key={tier.id}
              className="flex flex-col rounded-lg border border-border bg-surface p-5"
            >
              {discount ? (
                <PlanSpecialDiscountBadge
                  discountPercent={discount.percent}
                  discountUntil={discount.until}
                  discountPromoMonths={discount.months}
                  className="mb-3 rounded-md border border-amber-700/35 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950"
                />
              ) : null}
              <h2 className="font-display text-xl">{tier.label}</h2>
              <p className="mt-1 text-sm font-medium text-accent">
                {tier.usersLabel}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {monthlyList ? (
                  <span className="mr-2 text-lg font-normal text-muted-foreground line-through">
                    {monthlyList}
                  </span>
                ) : null}
                {monthlyBtn}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / mes
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                o{" "}
                {annualList ? (
                  <span className="line-through">{annualList}</span>
                ) : null}{" "}
                {annualList ? (
                  <span className="font-medium text-foreground">{annualBtn}</span>
                ) : (
                  annualBtn
                )}{" "}
                / año
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
