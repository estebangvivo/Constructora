import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCashSessionById } from "@/features/treasury/queries/cash-queries";
import { CashSessionControls } from "@/features/treasury/components/cash-session-controls";
import {
  CASH_MOVEMENT_LABEL,
  CASH_SESSION_STATUS_LABEL,
  CASH_SESSION_STATUS_STYLE,
  formatCashMoney,
} from "@/features/treasury/lib/cash-labels";
import { formatDateAR } from "@/lib/format-date";

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function CashSessionPage({ params }: PageProps) {
  const auth = await getSession();
  if (!auth) redirect("/sign-in");

  const { sessionId } = await params;
  const session = await getCashSessionById(sessionId);
  if (!session) notFound();

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    auth.organizationRole,
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
      <h1 className="font-display text-3xl tracking-tight">
        {session.number}{" "}
        <span
          className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CASH_SESSION_STATUS_STYLE[session.status]}`}
        >
          {CASH_SESSION_STATUS_LABEL[session.status]}
        </span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Caja diaria · {formatDateAR(session.businessDate)}
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Apertura</dt>
          <dd className="font-display text-xl">
            {formatCashMoney(session.openingBalance, session.currency)}
          </dd>
        </div>
        <div className="border-l-2 border-success pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Ingresos</dt>
          <dd className="font-display text-xl">
            {formatCashMoney(session.incomeTotal, session.currency)}
          </dd>
        </div>
        <div className="border-l-2 border-danger pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Egresos</dt>
          <dd className="font-display text-xl">
            {formatCashMoney(session.expenseTotal, session.currency)}
          </dd>
        </div>
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Saldo</dt>
          <dd className="font-display text-xl">
            {formatCashMoney(session.runningBalance, session.currency)}
          </dd>
        </div>
      </dl>

      {session.status === "CLOSED" && (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="border-l-2 border-border pl-3">
            <dt className="text-xs uppercase text-muted-foreground">
              Contado
            </dt>
            <dd className="font-medium">
              {formatCashMoney(session.countedBalance ?? 0, session.currency)}
            </dd>
          </div>
          <div className="border-l-2 border-border pl-3">
            <dt className="text-xs uppercase text-muted-foreground">
              Diferencia
            </dt>
            <dd className="font-medium">
              {formatCashMoney(session.difference ?? 0, session.currency)}
            </dd>
          </div>
          <div className="border-l-2 border-success pl-3">
            <dt className="text-xs uppercase text-muted-foreground">
              A tesorería
            </dt>
            <dd className="font-medium">
              {formatCashMoney(
                session.transferredAmount ?? 0,
                session.currency,
              )}
            </dd>
          </div>
        </dl>
      )}

      <section className="mt-8 space-y-3">
        <h2 className="font-medium">Movimientos</h2>
        {session.movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos aún.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {session.movements.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{CASH_MOVEMENT_LABEL[m.type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.description}
                  </p>
                </div>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    m.amount >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {m.amount >= 0 ? "+" : ""}
                  {formatCashMoney(m.amount, session.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <CashSessionControls session={session} canManage={canManage} />
      </div>
    </div>
  );
}
