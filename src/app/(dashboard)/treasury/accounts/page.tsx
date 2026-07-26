import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  listClientAccountSummaries,
  listSupplierAccountSummaries,
} from "@/features/treasury/queries/account-statements";
import { formatMoney } from "@/features/treasury/lib/labels";

export const dynamic = "force-dynamic";

export default async function TreasuryAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [clients, suppliers] = await Promise.all([
    listClientAccountSummaries(),
    listSupplierAccountSummaries(),
  ]);

  return (
    <div className="space-y-8 px-4 py-6 lg:px-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/treasury" className="hover:text-foreground">
            Tesorería
          </Link>
        </p>
        <h1 className="font-display text-3xl tracking-tight">
          Cuentas corrientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saldos y aging de clientes (certificaciones / recibos) y proveedores
          (facturas / órdenes de pago).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-tight">Clientes</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin saldos abiertos de clientes.
          </p>
        ) : (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-3 font-medium">Cliente</th>
                  <th className="py-3 pr-3 font-medium text-right">0–30</th>
                  <th className="py-3 pr-3 font-medium text-right">31–60</th>
                  <th className="py-3 pr-3 font-medium text-right">61–90</th>
                  <th className="py-3 pr-3 font-medium text-right">+90</th>
                  <th className="py-3 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/treasury/accounts/clients/${c.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(c.aging.b0_30, c.currency)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(c.aging.b31_60, c.currency)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(c.aging.b61_90, c.currency)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(c.aging.b90_plus, c.currency)}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums">
                      {formatMoney(c.balance, c.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-tight">Proveedores</h2>
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin saldos abiertos de proveedores.
          </p>
        ) : (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-3 font-medium">Proveedor</th>
                  <th className="py-3 pr-3 font-medium text-right">0–30</th>
                  <th className="py-3 pr-3 font-medium text-right">31–60</th>
                  <th className="py-3 pr-3 font-medium text-right">61–90</th>
                  <th className="py-3 pr-3 font-medium text-right">+90</th>
                  <th className="py-3 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/treasury/accounts/suppliers/${s.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(s.aging.b0_30, s.currency)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(s.aging.b31_60, s.currency)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(s.aging.b61_90, s.currency)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatMoney(s.aging.b90_plus, s.currency)}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums">
                      {formatMoney(s.balance, s.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
