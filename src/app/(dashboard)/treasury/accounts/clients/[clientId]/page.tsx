import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAccountStatement } from "@/features/treasury/queries/account-statements";
import { formatMoney } from "@/features/treasury/lib/labels";
import { formatDateAR } from "@/lib/format-date";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function ClientAccountPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { clientId } = await params;
  const stmt = await getClientAccountStatement(clientId);
  if (!stmt) notFound();

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/treasury/accounts" className="hover:text-foreground">
            Cuentas corrientes
          </Link>
        </p>
        <h1 className="font-display text-3xl tracking-tight">
          {stmt.partyName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuenta corriente cliente
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border-l-2 border-accent pl-3 sm:col-span-2 lg:col-span-1">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Saldo
          </dt>
          <dd className="mt-1 font-display text-2xl tabular-nums">
            {formatMoney(stmt.balance, stmt.currency)}
          </dd>
        </div>
        {(
          [
            ["0–30", stmt.aging.b0_30],
            ["31–60", stmt.aging.b31_60],
            ["61–90", stmt.aging.b61_90],
            ["+90", stmt.aging.b90_plus],
          ] as const
        ).map(([label, amount]) => (
          <div key={label} className="border-l-2 border-border pl-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              {label} días
            </dt>
            <dd className="mt-1 font-display text-xl tabular-nums">
              {formatMoney(amount, stmt.currency)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-3 pr-3 font-medium">Fecha</th>
              <th className="py-3 pr-3 font-medium">Documento</th>
              <th className="py-3 pr-3 font-medium">Detalle</th>
              <th className="py-3 pr-3 font-medium text-right">Debe</th>
              <th className="py-3 font-medium text-right">Haber</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stmt.movements.map((m) => (
              <tr key={m.id}>
                <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                  {formatDateAR(m.date)}
                </td>
                <td className="py-3 pr-3">
                  <Link
                    href={m.href}
                    className="font-medium text-accent hover:underline"
                  >
                    {m.number}
                  </Link>
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {m.description}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">
                  {m.debit > 0 ? formatMoney(m.debit, m.currency) : "—"}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {m.credit > 0 ? formatMoney(m.credit, m.currency) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
