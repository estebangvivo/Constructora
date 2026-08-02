import Link from "next/link";
import { CreditCard } from "lucide-react";
import {
  BILLING_PLANS,
  formatPlanUsersLabel,
  normalizeBillingPlanId,
} from "@/features/billing/lib/plans";
import { formatDateAR } from "@/lib/format-date";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  PAST_DUE: "Vencido",
  PENDING_PAYMENT: "Pago pendiente",
  EXEMPT: "Exento",
};

type OrganizationPlanCardProps = {
  billingPlan: string | null;
  billingStatus: string;
  paidUntil: Date | string | null;
};

export function OrganizationPlanCard({
  billingPlan,
  billingStatus,
  paidUntil,
}: OrganizationPlanCardProps) {
  const planId = normalizeBillingPlanId(billingPlan);
  const planLabel = planId ? BILLING_PLANS[planId].label : "Sin plan";
  const seatsLabel = planId
    ? formatPlanUsersLabel(BILLING_PLANS[planId].maxUsers)
    : null;
  const statusLabel = STATUS_LABEL[billingStatus] ?? billingStatus;
  const isExempt = billingStatus === "EXEMPT";

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="font-display text-lg tracking-tight">Suscripción</h2>
        <p className="text-sm text-muted-foreground">
          Plan actual de la empresa y opción para cambiarlo o renovarlo.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Plan:</span> {planLabel}
        </p>
        {seatsLabel ? (
          <p>
            <span className="text-muted-foreground">Cupo:</span> {seatsLabel}
          </p>
        ) : null}
        <p>
          <span className="text-muted-foreground">Estado:</span> {statusLabel}
        </p>
        <p>
          <span className="text-muted-foreground">Vigente hasta:</span>{" "}
          {isExempt ? "Sin vencimiento" : formatDateAR(paidUntil)}
        </p>

        {isExempt ? (
          <p className="text-muted-foreground">
            Esta empresa está exenta de facturación.
          </p>
        ) : null}

        <div className="pt-2">
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            <CreditCard className="size-4 shrink-0" aria-hidden />
            Modificar plan
          </Link>
        </div>
      </div>
    </section>
  );
}
