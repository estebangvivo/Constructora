import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listBankAccounts } from "@/features/treasury/queries/bank-queries";
import { listChecks } from "@/features/treasury/queries/list-checks";
import { getCashOverview } from "@/features/treasury/queries/cash-queries";
import { getEnabledCurrencies } from "@/features/settings/queries/get-organization";
import { BankDepositForm } from "@/features/treasury/components/bank-deposit-form";
import { formatMoney } from "@/features/treasury/lib/labels";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ bankId?: string }>;
};

export default async function BankDepositPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { bankId } = await searchParams;
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  const [banks, checks, enabledCurrencies] = await Promise.all([
    listBankAccounts({ activeOnly: true }),
    listChecks({ status: "IN_PORTFOLIO" }),
    getEnabledCurrencies(),
  ]);

  const overviews = await Promise.all(
    enabledCurrencies.map(async (currency) => ({
      currency,
      overview: await getCashOverview(currency),
    })),
  );

  const dailyBalances: Record<string, number> = {};
  const treasuryBalances: Record<string, number> = {};
  for (const { currency, overview } of overviews) {
    dailyBalances[currency] = overview.daily.balance;
    treasuryBalances[currency] = overview.treasury.balance;
  }

  const defaultBankId =
    bankId && banks.some((b) => b.id === bankId) ? bankId : "";

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/treasury" className="hover:text-foreground">
          Tesorería
        </Link>
        {" · "}
        <Link href="/treasury/banks" className="hover:text-foreground">
          Bancos
        </Link>
      </p>
      <h1 className="font-display text-3xl tracking-tight">
        Depósitos y extracciones
      </h1>
      <p className="mt-1 text-muted-foreground">
        Depositá efectivo o cheques al banco, o extraé efectivo hacia caja.
      </p>

      <div className="mt-8 max-w-2xl">
        <BankDepositForm
          canManage={canManage}
          defaultBankId={defaultBankId}
          dailyBalances={dailyBalances}
          treasuryBalances={treasuryBalances}
          banks={banks.map((b) => ({
            id: b.id,
            name: b.name,
            bankName: b.bankName,
            currency: b.currency,
            balance: b.balance,
            label: `${b.name} · ${b.bankName} (${b.currency})`,
          }))}
          checks={checks.map((c) => ({
            id: c.id,
            number: c.number,
            bank: c.bank,
            amount: c.amount,
            currency: c.currency,
            dueDate: c.dueDate
              ? c.dueDate.toLocaleDateString("es-AR")
              : null,
            label: `${c.number} · ${c.bank} · ${formatMoney(c.amount, c.currency)}`,
          }))}
        />
      </div>
    </div>
  );
}
