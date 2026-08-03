import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProjectsForTreasury } from "@/features/treasury/queries/list-projects-for-treasury";
import { listActiveSuppliers } from "@/features/suppliers/queries/list-suppliers";
import {
  getEnabledCurrencies,
  getOrganizationCurrency,
} from "@/features/settings/queries/get-organization";
import { listPortfolioChecksForPayment } from "@/features/treasury/queries/list-checks";
import { listActiveBankAccountsForPayment } from "@/features/treasury/queries/bank-queries";
import { listOpenPurchaseInvoices } from "@/features/treasury/queries/account-statements";
import { getCertificationById } from "@/features/certifications/queries/list-certifications";
import { TreasuryDocumentForm } from "@/features/treasury/components/treasury-document-form";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ projectId?: string; certificationId?: string }>;
};

export default async function NewPaymentOrderPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { projectId, certificationId } = await searchParams;
  const certId = certificationId?.trim() || "";

  const [
    projects,
    suppliers,
    currency,
    enabledCurrencies,
    portfolioChecks,
    bankAccounts,
    openInvoices,
    cert,
  ] = await Promise.all([
    listProjectsForTreasury(),
    listActiveSuppliers(),
    getOrganizationCurrency(),
    getEnabledCurrencies(),
    listPortfolioChecksForPayment(),
    listActiveBankAccountsForPayment(),
    listOpenPurchaseInvoices(projectId ? { projectId } : undefined),
    certId ? getCertificationById(certId) : Promise.resolve(null),
  ]);

  const defaultProjectId =
    (cert?.projectId && projects.some((p) => p.id === cert.projectId)
      ? cert.projectId
      : null) ||
    (projectId && projects.some((p) => p.id === projectId) ? projectId : "");

  const fromCert =
    cert &&
    (!defaultProjectId || cert.projectId === defaultProjectId)
      ? cert
      : null;

  const defaultConcept = fromCert
    ? `Pago mano de obra · certificación ${fromCert.number}`
    : "";
  const defaultAmount = fromCert ? fromCert.netAmount : 0;
  const defaultCurrency = fromCert?.currency || currency;

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
      {fromCert ? (
        <p className="mb-4 rounded-md border border-border bg-surface/40 px-3 py-2 text-sm text-muted-foreground">
          Prefill desde certificación{" "}
          <span className="font-medium text-foreground">{fromCert.number}</span>
          {" · "}
          neto sugerido{" "}
          {fromCert.netAmount.toLocaleString("es-AR", {
            style: "currency",
            currency: fromCert.currency,
          })}
          . Elegí proveedor o escribí el nombre del obrero / cuadrilla.
        </p>
      ) : null}
      <TreasuryDocumentForm
        kind="payment-order"
        projects={projects}
        parties={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        defaultCurrency={defaultCurrency}
        enabledCurrencies={enabledCurrencies}
        defaultProjectId={defaultProjectId}
        portfolioChecks={portfolioChecks}
        bankAccounts={bankAccounts}
        openDocuments={openInvoices.map((i) => ({
          id: i.id,
          label: i.label,
          balance: i.balance,
          currency: i.currency,
        }))}
        defaultConcept={defaultConcept}
        defaultAmount={defaultAmount}
        defaultPartyId={fromCert ? "" : undefined}
      />
    </div>
  );
}
