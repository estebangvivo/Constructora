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
import { TreasuryDocumentForm } from "@/features/treasury/components/treasury-document-form";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ projectId?: string }>;
};

export default async function NewReceiptPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { projectId } = await searchParams;

  const [projects, clients, currency, enabledCurrencies, bankAccounts] =
    await Promise.all([
      listProjectsForTreasury(),
      listActiveClients(),
      getOrganizationCurrency(),
      getEnabledCurrencies(),
      listActiveBankAccountsForPayment(),
    ]);

  const defaultProjectId =
    projectId && projects.some((p) => p.id === projectId) ? projectId : "";

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/treasury/receipts" className="hover:text-foreground">
          Recibos
        </Link>
      </p>
      <h1 className="mb-6 font-display text-3xl tracking-tight">Nuevo recibo</h1>
      <TreasuryDocumentForm
        kind="receipt"
        projects={projects}
        parties={clients.map((c) => ({ id: c.id, name: c.name }))}
        defaultCurrency={currency}
        enabledCurrencies={enabledCurrencies}
        defaultProjectId={defaultProjectId}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}
