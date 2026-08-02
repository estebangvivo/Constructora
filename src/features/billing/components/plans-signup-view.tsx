import Link from "next/link";
import { BILLING_PLANS, BILLING_TIERS } from "@/features/billing/lib/plans";
import type { EffectivePlanPrice } from "@/features/billing/lib/effective-plans";
import { PlanSpecialDiscountBadge } from "@/features/billing/components/plan-special-discount-badge";

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

type PlansSignupViewProps = {
  prices: Record<string, EffectivePlanPrice>;
  /** Si false, los botones no navegan (vista previa admin). */
  interactive?: boolean;
};

/** Pantalla “Elegí tu plan” (registro) o su vista previa estática. */
export function PlansSignupView({
  prices,
  interactive = true,
}: PlansSignupViewProps) {
  const trialRow = prices.TRIAL;
  if (!trialRow) return null;

  const trialLabel = amountLabel(trialRow);
  const trialIsFree =
    (trialRow.priceArs != null ? trialRow.priceArs : trialRow.priceUsd) <= 0;
  const tiers = Object.values(BILLING_TIERS);

  const TrialCta = interactive ? (
    <Link
      href="/onboarding/pago?plan=TRIAL"
      className="mt-4 inline-flex shrink-0 justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium sm:mt-0"
    >
      Empezar prueba · {trialLabel}
    </Link>
  ) : (
    <span className="mt-4 inline-flex shrink-0 justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium sm:mt-0">
      Empezar prueba · {trialLabel}
    </span>
  );

  return (
    <div className="space-y-8">
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
        {TrialCta}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => {
          const monthly = prices[tier.monthly];
          const annual = prices[tier.annual];
          if (!monthly || !annual) return null;
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
                {interactive ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <span className="inline-flex justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground">
                      Mensual · {monthlyBtn}
                    </span>
                    <span className="inline-flex justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium">
                      Anual · {annualBtn}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
