import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutLocal } from "@/features/auth/actions/auth-actions";
import { getMyBillingContext } from "@/features/billing/actions/billing-actions";
import { getBillingUsdArsRate } from "@/features/billing/lib/fx";
import {
  getMpSurchargePercent,
  getTransferBankDetailsEffective,
  isMercadoPagoConfigured,
} from "@/features/billing/lib/platform-billing-settings";
import { BillingRenewalPanel } from "@/features/billing/components/billing-renewal-panel";
import { MercadoPagoReturnSync } from "@/features/billing/components/mercadopago-return-sync";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import {
  BILLING_PLANS,
  formatPlanUsersLabel,
  normalizeBillingPlanId,
  type PaidBillingPlanId,
  PAID_BILLING_PLANS,
} from "@/features/billing/lib/plans";
import {
  getEffectivePlanPrices,
  resolvePlanQuote,
} from "@/features/billing/lib/effective-plans";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { formatDateAR } from "@/lib/format-date";
import { AppBrandLogo } from "@/components/brand/app-brand-logo";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    mp?: string;
    payment_id?: string;
    collection_id?: string;
    external_reference?: string;
    status?: string;
    preference_id?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.organizationId) redirect("/onboarding/planes");

  const superadmin = isPlatformSuperadmin(session);
  const sp = await searchParams;
  const mpReturn =
    sp.mp === "success" || Boolean(sp.payment_id || sp.collection_id);
  const [
    { organization, payments },
    usdArsRate,
    mpConfigured,
    planPrices,
    bank,
    mpSurchargePercent,
  ] = await Promise.all([
    getMyBillingContext(),
    getBillingUsdArsRate(),
    isMercadoPagoConfigured(),
    getEffectivePlanPrices(),
    getTransferBankDetailsEffective(),
    getMpSurchargePercent(),
  ]);

  const paidIds = Object.keys(PAID_BILLING_PLANS) as PaidBillingPlanId[];
  const orgQuotes = await Promise.all(
    paidIds.map(async (id) => {
      const quote = await resolvePlanQuote({
        plan: id,
        organizationId: session.organizationId,
      });
      return [id, quote] as const;
    }),
  );
  const priceUsdByPlan = Object.fromEntries(
    orgQuotes.map(([id, quote]) => [id, quote.priceUsd]),
  ) as Partial<Record<PaidBillingPlanId, number>>;
  const planPricesById = Object.fromEntries(
    orgQuotes.map(([id, quote]) => {
      const campaign = planPrices[id];
      return [
        id,
        {
          priceUsd: quote.priceUsd,
          listPriceUsd: quote.listPriceUsd,
          discountPercent: quote.discountPercent,
          discountUntil:
            quote.source === "campaign"
              ? quote.discountUntil
              : campaign.discountUntil,
          discountPromoMonths:
            quote.source === "campaign"
              ? quote.discountPromoMonths
              : campaign.discountPromoMonths,
          discountSource: quote.source,
        },
      ];
    }),
  ) as Partial<
    Record<
      PaidBillingPlanId,
      {
        priceUsd: number;
        listPriceUsd: number;
        discountPercent: number | null;
        discountUntil: string | null;
        discountPromoMonths: number | null;
        discountSource: "none" | "campaign" | "org";
      }
    >
  >;

  const hasAccess =
    superadmin ||
    (organization &&
      organizationHasAppAccess({
        billingStatus: organization.billingStatus,
        paidUntil: organization.paidUntil
          ? new Date(organization.paidUntil)
          : null,
      }));

  const planId = normalizeBillingPlanId(organization?.billingPlan);
  const wasTrial = organization?.billingPlan === "TRIAL" || planId === "TRIAL";
  const planLabel = planId ? BILLING_PLANS[planId].label : "—";
  const seatsLabel = planId
    ? formatPlanUsersLabel(BILLING_PLANS[planId].maxUsers)
    : null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <AppBrandLogo size="header" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {organization?.name ?? "Suscripción"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {session.user.email}
              </p>
            </div>
          </div>
          <form action={logoutLocal}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-tight">Suscripción</h1>
          <p className="mt-1 text-muted-foreground">
            Estado de pago y renovación de {organization?.name ?? "tu empresa"}.
          </p>
          {hasAccess && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href="/" className="text-accent hover:underline">
                ← Volver al sistema
              </Link>
              <Link href="/settings" className="text-accent hover:underline">
                Ir a configuración
              </Link>
            </p>
          )}
          {!hasAccess && wasTrial && (
            <p className="mt-3 rounded-md border border-amber-700/30 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Tu prueba de 30 días terminó. Elegí un plan (unipersonal desde
              USD 59, equipo USD 99 o ilimitado USD 119) para seguir usando el
              sistema.
            </p>
          )}
          {mpReturn && (
            <div className="mt-3 space-y-2">
              <MercadoPagoReturnSync
                paymentId={sp.payment_id}
                collectionId={sp.collection_id}
                externalReference={sp.external_reference}
                status={sp.status}
                preferenceId={sp.preference_id}
                successHref="/billing"
              />
              <p className="rounded-md border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Pago recibido. Si no ves el acceso activo aún, esperá unos
                segundos y recargá.
              </p>
            </div>
          )}
        </div>

        <div className="mb-8 space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Estado:</span>{" "}
            {organization?.billingStatus ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Plan:</span> {planLabel}
          </p>
          {seatsLabel && (
            <p>
              <span className="text-muted-foreground">Cupo:</span> {seatsLabel}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Vigente hasta:</span>{" "}
            {organization?.paidUntil
              ? formatDateAR(organization.paidUntil)
              : "—"}
          </p>
        </div>

        <BillingRenewalPanel
          usdArsRate={usdArsRate}
          bank={bank}
          mpConfigured={mpConfigured}
          priceUsdByPlan={priceUsdByPlan}
          planPricesById={planPricesById}
          mpSurchargePercent={mpSurchargePercent}
          heading={
            hasAccess && !wasTrial
              ? "Cambiar o renovar plan"
              : "Renovar acceso"
          }
          description={
            organization?.billingStatus === "EXEMPT"
              ? "Esta empresa está exenta. Si elegís un plan de pago, se aplicará al aprobar el pago."
              : hasAccess && wasTrial
                ? "Estás en prueba. Elegí un plan para seguir después de los 30 días y para poder dar de alta más usuarios."
                : hasAccess
                  ? "Podés subir de plan, bajar o renovar el periodo actual. El nuevo plan se aplica al aprobar el pago."
                  : undefined
          }
        />

        <section className="mt-10">
          <h2 className="font-display text-lg">Historial</h2>
          <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
            {payments.length === 0 && (
              <li className="py-3 text-muted-foreground">Sin pagos aún.</li>
            )}
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <span>
                  {p.plan} · {p.method} · {p.currency}{" "}
                  {p.amount.toLocaleString("es-AR")}
                </span>
                <span className="text-muted-foreground">
                  {p.status} · {formatDateAR(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
