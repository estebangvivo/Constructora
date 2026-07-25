import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProjectsForTreasury } from "@/features/treasury/queries/list-projects-for-treasury";
import { listActiveSuppliers } from "@/features/suppliers/queries/list-suppliers";
import {
  getEnabledCurrencies,
  getOrganizationCurrency,
} from "@/features/settings/queries/get-organization";
import { TreasuryDocumentForm } from "@/features/treasury/components/treasury-document-form";

export const dynamic = "force-dynamic";

export default async function NewPaymentOrderPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [projects, suppliers, currency, enabledCurrencies] = await Promise.all([
    listProjectsForTreasury(),
    listActiveSuppliers(),
    getOrganizationCurrency(),
    getEnabledCurrencies(),
  ]);

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="text-sm text-muted-foreground">
        <Link
          href="/treasury/payment-orders"
          className="hover:text-foreground"
        >
          Órdenes de pago
        </Link>
      </p>
      <h1 className="mb-6 font-display text-3xl tracking-tight">
        Nueva orden de pago
      </h1>
      <TreasuryDocumentForm
        kind="payment-order"
        projects={projects}
        parties={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        defaultCurrency={currency}
        enabledCurrencies={enabledCurrencies}
      />
    </div>
  );
}
