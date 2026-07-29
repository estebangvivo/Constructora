import Link from "next/link";
import type { AccountStatement } from "@/features/treasury/queries/account-statements";
import { formatMoney } from "@/features/treasury/lib/labels";
import { projectHref } from "@/config/navigation";

type ProjectClientAccountProps = {
  projectId: string;
  clientId: string | null;
  statement: AccountStatement | null;
};

export function ProjectClientAccount({
  projectId,
  clientId,
  statement,
}: ProjectClientAccountProps) {
  if (!clientId) {
    return (
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">
            Cuenta corriente del cliente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo movimientos de esta obra.
          </p>
        </div>
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Asigná un cliente a la obra para ver su cuenta corriente.{" "}
          <Link
            href={projectHref(projectId, "/stakeholders")}
            className="text-accent hover:underline"
          >
            Ir a Cliente y proveedores
          </Link>
        </p>
      </section>
    );
  }

  if (!statement) return null;

  let running = 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">
            Cuenta corriente del cliente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {statement.partyName} · solo esta obra
          </p>
        </div>
        <Link
          href={`/treasury/accounts/clients/${statement.partyId}`}
          className="text-xs text-accent hover:underline"
        >
          Ver CT global del cliente
        </Link>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border-l-2 border-accent pl-3 sm:col-span-2 lg:col-span-1">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Saldo
          </dt>
          <dd className="mt-1 font-display text-2xl tabular-nums">
            {formatMoney(statement.balance, statement.currency)}
          </dd>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {statement.balance > 0.009
              ? "A cobrar"
              : statement.balance < -0.009
                ? "A favor del cliente"
                : "Sin saldo"}
          </p>
        </div>
        {(
          [
            ["0–30", statement.aging.b0_30],
            ["31–60", statement.aging.b31_60],
            ["61–90", statement.aging.b61_90],
            ["+90", statement.aging.b90_plus],
          ] as const
        ).map(([label, amount]) => (
          <div key={label} className="border-l-2 border-border pl-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              {label} días
            </dt>
            <dd className="mt-1 font-display text-xl tabular-nums">
              {formatMoney(amount, statement.currency)}
            </dd>
          </div>
        ))}
      </dl>

      {statement.movements.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Todavía no hay certificaciones ni cobros imputados a esta obra.
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3 font-medium">Fecha</th>
                <th className="py-3 pr-3 font-medium">Documento</th>
                <th className="py-3 pr-3 font-medium">Detalle</th>
                <th className="py-3 pr-3 font-medium text-right">Debe</th>
                <th className="py-3 pr-3 font-medium text-right">Haber</th>
                <th className="py-3 font-medium text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {statement.movements.map((m) => {
                running = Math.round((running + m.debit - m.credit) * 100) / 100;
                return (
                  <tr key={m.id}>
                    <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                      {new Date(`${m.date}T12:00:00`).toLocaleDateString("es-AR")}
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
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {m.credit > 0 ? formatMoney(m.credit, m.currency) : "—"}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatMoney(running, m.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
