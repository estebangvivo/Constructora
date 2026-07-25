import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listBankAccounts } from "@/features/treasury/queries/bank-queries";
import { formatMoney } from "@/features/treasury/lib/labels";
import {
  formatMoneyByCurrency,
  sumByCurrency,
} from "@/config/currencies";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const accounts = await listBankAccounts({ activeOnly: true });
  const totals = sumByCurrency(
    accounts.map((a) => ({ currency: a.currency, amount: a.balance })),
  );

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/treasury" className="hover:text-foreground">
          Tesorería
        </Link>
      </p>
      <h1 className="font-display text-3xl tracking-tight">Bancos</h1>
      <p className="mt-1 text-muted-foreground">
        Saldos de cuentas propias. Los movimientos se generan al imputar
        transferencias.{" "}
        <Link href="/settings" className="text-accent hover:underline">
          Administrar cuentas
        </Link>
      </p>

      <div className="mt-6 border-l-2 border-accent pl-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Saldo consolidado
        </p>
        <p className="font-display text-2xl">{formatMoneyByCurrency(totals)}</p>
      </div>

      {accounts.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No hay cuentas activas. Dálas de alta en{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Configuración
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {accounts.map((account) => (
            <li key={account.id}>
              <Link
                href={`/treasury/banks/${account.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-accent">
                    <Landmark className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[account.bankName, account.accountNumber, account.alias]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <p className="font-medium tabular-nums sm:text-right">
                  {formatMoney(account.balance, account.currency)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
