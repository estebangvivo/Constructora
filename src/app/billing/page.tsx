import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getMyBillingContext } from "@/features/billing/actions/billing-actions";
import { getBillingUsdArsRate } from "@/features/billing/lib/fx";
import {
  getTransferBankDetails,
  isMercadoPagoConfigured,
} from "@/features/billing/lib/transfer-config";
import { BillingRenewalPanel } from "@/features/billing/components/billing-renewal-panel";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import {
  BILLING_PLANS,
  formatPlanUsersLabel,
  normalizeBillingPlanId,
} from "@/features/billing/lib/plans";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ mp?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.organizationId) redirect("/onboarding/planes");

  const sp = await searchParams;
  const [{ organization, payments }, usdArsRate, mpConfigured] =
    await Promise.all([
      getMyBillingContext(),
      getBillingUsdArsRate(),
      isMercadoPagoConfigured(),
    ]);

  const hasAccess =
    organization &&
    organizationHasAppAccess({
      billingStatus: organization.billingStatus,
      paidUntil: organization.paidUntil
        ? new Date(organization.paidUntil)
        : null,
    });

  const planId = normalizeBillingPlanId(organization?.billingPlan);
  const wasTrial = organization?.billingPlan === "TRIAL" || planId === "TRIAL";
  const planLabel = planId ? BILLING_PLANS[planId].label : "—";
  const seatsLabel = planId
    ? formatPlanUsersLabel(BILLING_PLANS[planId].maxUsers)
    : null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-tight">Suscripción</h1>
          <p className="mt-1 text-muted-foreground">
            Estado de pago y renovación de {organization?.name ?? "tu empresa"}.
          </p>
          {hasAccess && (
            <p className="mt-2 text-sm">
              <Link href="/" className="text-accent hover:underline">
                ← Volver al sistema
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
          {sp.mp === "success" && (
            <p className="mt-3 rounded-md border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Pago recibido. Si no ves el acceso activo aún, esperá unos segundos
              y recargá.
            </p>
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
              ? new Date(organization.paidUntil).toLocaleDateString("es-AR")
              : "—"}
          </p>
        </div>

        {!hasAccess || wasTrial ? (
          <>
            {hasAccess && wasTrial && (
              <p className="mb-4 text-sm text-muted-foreground">
                Estás en prueba. Elegí un plan para seguir después de los 30 días
                y para poder dar de alta más usuarios.
              </p>
            )}
            <BillingRenewalPanel
              usdArsRate={usdArsRate}
              bank={getTransferBankDetails()}
              mpConfigured={mpConfigured}
            />
          </>
        ) : null}

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
                  {p.status} ·{" "}
                  {new Date(p.createdAt).toLocaleDateString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
