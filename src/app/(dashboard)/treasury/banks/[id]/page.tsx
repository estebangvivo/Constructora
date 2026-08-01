import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getOrganizationSession } from "@/lib/auth";
import { getBankAccountDetail } from "@/features/treasury/queries/bank-queries";
import {
  BANK_MOVEMENT_LABEL,
  formatMoney,
} from "@/features/treasury/lib/labels";
import { BankAdjustmentForm } from "@/features/treasury/components/bank-adjustment-form";
import { formatDateAR } from "@/lib/format-date";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function BankAccountDetailPage({ params }: PageProps) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const detail = await getBankAccountDetail(id);
  if (!detail) notFound();

  const { account, movements } = detail;
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

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
      <h1 className="font-display text-3xl tracking-tight">{account.name}</h1>
      <p className="mt-1 text-muted-foreground">
        {[account.bankName, account.accountNumber, account.alias]
          .filter(Boolean)
          .join(" · ")}
        {!account.isActive ? " · Inactiva" : ""}
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="border-l-2 border-success pl-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Saldo actual
          </p>
          <p className="font-display text-3xl">
            {formatMoney(account.balance, account.currency)}
          </p>
        </div>
        <Link
          href={`/treasury/banks/deposit?bankId=${account.id}`}
          className="rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Depositar / extraer
        </Link>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="font-medium">Ajuste manual</h2>
        <BankAdjustmentForm
          bankAccountId={account.id}
          canManage={canManage}
        />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-medium">Movimientos</h2>
        {movements.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos en esta cuenta.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{BANK_MOVEMENT_LABEL[m.type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.description} · {formatDateAR(m.occurredAt)}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p
                    className={`font-medium tabular-nums ${
                      m.amount >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatMoney(m.amount, account.currency)}
                  </p>
                  {m.balanceAfter != null && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Saldo {formatMoney(m.balanceAfter, account.currency)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
