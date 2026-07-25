import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCashOverview } from "@/features/treasury/queries/cash-queries";
import { TreasuryCashForm } from "@/features/treasury/components/treasury-cash-form";
import {
  CASH_MOVEMENT_LABEL,
  formatCashMoney,
} from "@/features/treasury/lib/cash-labels";
import { formatDateAR } from "@/lib/format-date";

export const dynamic = "force-dynamic";

export default async function TreasuryCashPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const overview = await getCashOverview("ARS");
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
        <Link href="/treasury/cash" className="hover:text-foreground">
          Caja
        </Link>
      </p>
      <h1 className="font-display text-3xl tracking-tight">Caja tesorería</h1>
      <p className="mt-1 text-muted-foreground">
        Acumula los cierres de caja diaria. También podés depositar o extraer.
      </p>

      <div className="mt-6 border-l-2 border-success pl-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Saldo actual
        </p>
        <p className="font-display text-3xl">
          {formatCashMoney(
            overview.treasury.balance,
            overview.treasury.currency,
          )}
        </p>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="font-medium">Movimiento manual</h2>
        <TreasuryCashForm
          currency={overview.treasury.currency}
          canManage={canManage}
        />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-medium">Historial</h2>
        {overview.treasuryMovements.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos. Los cierres diarios se acumulan acá.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {overview.treasuryMovements.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{CASH_MOVEMENT_LABEL[m.type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.description} · {formatDateAR(m.occurredAt)}
                    {m.sourceSessionId ? (
                      <>
                        {" · "}
                        <Link
                          href={`/treasury/cash/sessions/${m.sourceSessionId}`}
                          className="text-accent hover:underline"
                        >
                          Ver sesión
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p
                    className={`font-medium tabular-nums ${
                      m.amount >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {m.amount >= 0 ? "+" : ""}
                    {formatCashMoney(m.amount, overview.treasury.currency)}
                  </p>
                  {m.balanceAfter != null && (
                    <p className="text-muted-foreground tabular-nums">
                      Saldo {formatCashMoney(m.balanceAfter, overview.treasury.currency)}
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
