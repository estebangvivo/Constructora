import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProjectsForTreasury } from "@/features/treasury/queries/list-projects-for-treasury";
import { listActiveClients } from "@/features/clients/queries/list-clients";
import {
  getEnabledCurrencies,
  getOrganizationCurrency,
} from "@/features/settings/queries/get-organization";
import { listActiveBankAccountsForPayment } from "@/features/treasury/queries/bank-queries";
import { listOpenCertifications } from "@/features/treasury/queries/account-statements";
import { TreasuryDocumentForm } from "@/features/treasury/components/treasury-document-form";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ projectId?: string; certificationId?: string }>;
};

export default async function NewReceiptPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { projectId, certificationId } = await searchParams;
  const certId = certificationId?.trim() || "";

  const [
    projects,
    clients,
    currency,
    enabledCurrencies,
    bankAccounts,
    openCerts,
  ] = await Promise.all([
    listProjectsForTreasury(),
    listActiveClients(),
    getOrganizationCurrency(),
    getEnabledCurrencies(),
    listActiveBankAccountsForPayment(),
    listOpenCertifications(projectId ? { projectId } : undefined),
  ]);

  const defaultProjectId =
    projectId && projects.some((p) => p.id === projectId) ? projectId : "";

  const prefillCert = certId
    ? openCerts.find((c) => c.id === certId) ?? null
    : null;

  const defaultDocumentApps = prefillCert
    ? [{ documentId: prefillCert.id, amount: prefillCert.balance }]
    : [];

  const defaultConcept = prefillCert
    ? `Cobro certificación ${prefillCert.number}`
    : "";

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/treasury/receipts" className="hover:text-foreground">
          Recibos
        </Link>
      </p>
      <h1 className="mb-6 font-display text-3xl tracking-tight">Nuevo recibo</h1>
      {prefillCert ? (
        <p className="mb-4 rounded-md border border-border bg-surface/40 px-3 py-2 text-sm text-muted-foreground">
          Prefill desde certificación{" "}
          <span className="font-medium text-foreground">{prefillCert.number}</span>
          {" · "}
          saldo {prefillCert.balance.toLocaleString("es-AR", {
            style: "currency",
            currency: prefillCert.currency,
          })}
        </p>
      ) : null}
      <TreasuryDocumentForm
        kind="receipt"
        projects={projects}
        parties={clients.map((c) => ({ id: c.id, name: c.name }))}
        defaultCurrency={currency}
        enabledCurrencies={enabledCurrencies}
        defaultProjectId={defaultProjectId}
        bankAccounts={bankAccounts}
        openDocuments={openCerts.map((c) => ({
          id: c.id,
          label: c.label,
          balance: c.balance,
          currency: c.currency,
        }))}
        defaultDocumentApps={defaultDocumentApps}
        defaultConcept={defaultConcept}
      />
    </div>
  );
}
