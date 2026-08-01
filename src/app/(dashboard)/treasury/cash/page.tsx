import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, Wallet } from "lucide-react";
import { getOrganizationSession } from "@/lib/auth";
import { getCashOverview } from "@/features/treasury/queries/cash-queries";
import { OpenCashSessionForm } from "@/features/treasury/components/open-cash-session-form";
import {
  CASH_MOVEMENT_LABEL,
  CASH_SESSION_STATUS_LABEL,
  CASH_SESSION_STATUS_STYLE,
  formatCashMoney,
} from "@/features/treasury/lib/cash-labels";
import { formatDateAR } from "@/lib/format-date";

export const dynamic = "force-dynamic";

export default async function CashHubPage() {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

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
      </p>
      <h1 className="font-display text-3xl tracking-tight">Caja</h1>
      <p className="mt-1 text-muted-foreground">
        Caja diaria operativa y caja tesorería que acumula los cierres.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border-l-2 border-accent pl-3">
          <dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Wallet className="size-3.5" aria-hidden />
            Caja diaria
          </dt>
          <dd className="mt-1 font-display text-2xl">
            {formatCashMoney(overview.daily.balance, overview.daily.currency)}
          </dd>
          <dd className="mt-1 text-sm text-muted-foreground">
            {overview.openSession
              ? `Sesión abierta ${overview.openSession.number}`
              : "Sin sesión abierta"}
          </dd>
        </div>
        <div className="border-l-2 border-success pl-3">
          <dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Landmark className="size-3.5" aria-hidden />
            Caja tesorería
          </dt>
          <dd className="mt-1 font-display text-2xl">
            {formatCashMoney(
              overview.treasury.balance,
              overview.treasury.currency,
            )}
          </dd>
          <dd className="mt-1 text-sm text-muted-foreground">
            <Link
              href="/treasury/cash/treasury"
              className="text-accent hover:underline"
            >
              Ver movimientos y depósitos
            </Link>
          </dd>
        </div>
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="font-display text-lg tracking-tight">Caja diaria</h2>
          {overview.openSession ? (
            <div className="rounded-md border border-border p-4">
              <p className="font-medium">
                {overview.openSession.number}{" "}
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CASH_SESSION_STATUS_STYLE[overview.openSession.status]}`}
                >
                  {CASH_SESSION_STATUS_LABEL[overview.openSession.status]}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDateAR(overview.openSession.businessDate)} · Apertura{" "}
                {formatCashMoney(
                  overview.openSession.openingBalance,
                  overview.openSession.currency,
                )}
              </p>
              <Link
                href={`/treasury/cash/sessions/${overview.openSession.id}`}
                className="mt-3 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
              >
                Ir a la sesión
              </Link>
            </div>
          ) : canManage ? (
            <div className="rounded-md border border-dashed border-border p-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Abrí la caja del día con un fondo inicial. Al cerrar, el efectivo
                contado pasa a caja tesorería.
              </p>
              <OpenCashSessionForm currency="ARS" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay caja diaria abierta.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg tracking-tight">
            Últimas sesiones
          </h2>
          {overview.recentSessions.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay sesiones de caja.
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {overview.recentSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/treasury/cash/sessions/${s.id}`}
                    className="flex flex-col gap-1 py-3 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {s.number}{" "}
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CASH_SESSION_STATUS_STYLE[s.status]}`}
                        >
                          {CASH_SESSION_STATUS_LABEL[s.status]}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateAR(s.businessDate)}
                        {s.transferredAmount != null && s.status === "CLOSED"
                          ? ` · A tesorería ${formatCashMoney(s.transferredAmount, s.currency)}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {s.countedBalance != null
                        ? formatCashMoney(s.countedBalance, s.currency)
                        : formatCashMoney(s.openingBalance, s.currency)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-tight">
            Movimientos recientes en tesorería
          </h2>
          <Link
            href="/treasury/cash/treasury"
            className="text-sm text-accent hover:underline"
          >
            Ver caja tesorería
          </Link>
        </div>
        {overview.treasuryMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Los cierres diarios aparecerán acá.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {overview.treasuryMovements.slice(0, 8).map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{CASH_MOVEMENT_LABEL[m.type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.description} · {formatDateAR(m.occurredAt)}
                  </p>
                </div>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    m.amount >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {m.amount >= 0 ? "+" : ""}
                  {formatCashMoney(m.amount, overview.treasury.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
