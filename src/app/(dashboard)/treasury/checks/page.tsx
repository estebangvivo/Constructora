import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getChecksDueAlert,
  listChecks,
} from "@/features/treasury/queries/list-checks";
import { listActiveBankAccountsForPayment } from "@/features/treasury/queries/bank-queries";
import {
  CHECK_STATUS_LABEL,
  CHECK_STATUS_STYLE,
  formatMoney,
} from "@/features/treasury/lib/labels";
import { BounceCheckButton } from "@/features/treasury/components/bounce-check-button";
import { DebitOwnCheckButton } from "@/features/treasury/components/debit-own-check-button";
import type { CheckStatus } from "@prisma/client";
import { formatDateAR } from "@/lib/format-date";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string; kind?: string }>;
};

const FILTERS: { value: CheckStatus | "ALL"; label: string }[] = [
  { value: "IN_PORTFOLIO", label: "En cartera" },
  { value: "DELIVERED", label: "Entregados" },
  { value: "DEPOSITED", label: "Depositados" },
  { value: "BOUNCED", label: "Rechazados" },
  { value: "ALL", label: "Todos" },
  { value: "CANCELLED", label: "Anulados" },
];

function parseStatus(raw?: string): CheckStatus | "ALL" {
  if (
    raw === "ALL" ||
    raw === "IN_PORTFOLIO" ||
    raw === "DELIVERED" ||
    raw === "DEPOSITED" ||
    raw === "BOUNCED" ||
    raw === "CANCELLED"
  ) {
    return raw;
  }
  return "IN_PORTFOLIO";
}

function parseKind(raw?: string): "THIRD_PARTY" | "OWN" {
  return raw === "OWN" ? "OWN" : "THIRD_PARTY";
}

/** @db.Date llega como medianoche UTC; comparar por día calendario local. */
function isDueReached(dueDate: Date | null): boolean {
  if (!dueDate) return true;
  const due = new Date(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate(),
  );
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() <= today.getTime();
}

export default async function ChecksPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  const { status: statusParam, kind: kindParam } = await searchParams;
  const kind = parseKind(kindParam);
  const status =
    statusParam != null
      ? parseStatus(statusParam)
      : kind === "OWN"
        ? "DELIVERED"
        : "IN_PORTFOLIO";
  const [checks, dueAlert, bankAccounts] = await Promise.all([
    listChecks({ status, kind }),
    getChecksDueAlert(),
    canManage
      ? listActiveBankAccountsForPayment()
      : Promise.resolve([]),
  ]);

  const urgencyById = new Map(
    [...dueAlert.overdue, ...dueAlert.dueSoon].map((c) => [
      c.id,
      c.daysUntilDue,
    ]),
  );

  const bankOptionsByCurrency = new Map<
    string,
    { id: string; label: string }[]
  >();
  for (const b of bankAccounts) {
    const key = b.currency.toUpperCase();
    const list = bankOptionsByCurrency.get(key) ?? [];
    list.push({ id: b.id, label: b.label });
    bankOptionsByCurrency.set(key, list);
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/treasury" className="hover:text-foreground">
            Tesorería
          </Link>
        </p>
        <h1 className="font-display text-3xl tracking-tight">
          {kind === "OWN" ? "Cheques propios" : "Cheques en cartera"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {kind === "OWN"
            ? "Emitidos en órdenes de pago. Al vencimiento, debitá la cuenta emisora para marcarlos como depositados."
            : "Entran al imputar un recibo con cheque. Salen al imputar una orden de pago, depositarlos o si son rechazados. El aviso anticipado se configura en "}
          {kind === "THIRD_PARTY" ? (
            <Link href="/settings" className="text-accent hover:underline">
              Configuración
            </Link>
          ) : null}
          {kind === "THIRD_PARTY" ? "." : null}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/treasury/checks"
          className={
            kind === "THIRD_PARTY"
              ? "rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm text-background"
              : "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
          }
        >
          De terceros
        </Link>
        <Link
          href="/treasury/checks?kind=OWN&status=DELIVERED"
          className={
            kind === "OWN"
              ? "rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm text-background"
              : "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
          }
        >
          Propios
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.filter(
          (f) => kind === "THIRD_PARTY" || f.value !== "IN_PORTFOLIO",
        ).map((f) => {
          const active = status === f.value;
          const href =
            kind === "OWN"
              ? `/treasury/checks?kind=OWN&status=${f.value}`
              : f.value === "IN_PORTFOLIO"
                ? "/treasury/checks"
                : `/treasury/checks?status=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={
                active
                  ? "rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm text-background"
                  : "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {checks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {status === "IN_PORTFOLIO"
            ? "No hay cheques disponibles en cartera."
            : "No hay cheques con este filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3 font-medium">N°</th>
                <th className="py-3 pr-3 font-medium">Banco</th>
                <th className="py-3 pr-3 font-medium">Monto</th>
                <th className="py-3 pr-3 font-medium">Vencimiento</th>
                <th className="py-3 pr-3 font-medium">Librador</th>
                <th className="py-3 pr-3 font-medium">Estado</th>
                <th className="py-3 pr-3 font-medium">Origen / destino</th>
                <th className="py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {checks.map((c) => {
                const days = urgencyById.get(c.id);
                const overdue = days != null && days < 0;
                const dueSoon = days != null && days >= 0;
                return (
                  <tr
                    key={c.id}
                    className={`align-top ${
                      c.status === "BOUNCED"
                        ? "bg-danger/10"
                        : overdue
                          ? "bg-danger/10"
                          : dueSoon
                            ? "bg-accent/10"
                            : ""
                    }`}
                  >
                    <td className="py-3 pr-3 font-medium tabular-nums">
                      {c.number}
                    </td>
                    <td className="py-3 pr-3">{c.bank}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      {formatMoney(c.amount, c.currency)}
                    </td>
                    <td
                      className={`py-3 pr-3 tabular-nums ${
                        overdue
                          ? "font-medium text-danger"
                          : dueSoon
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {c.dueDate
                        ? c.dueDate.toLocaleDateString("es-AR")
                        : "—"}
                      {overdue
                        ? " · vencido"
                        : dueSoon
                          ? days === 0
                            ? " · hoy"
                            : ` · ${days}d`
                          : null}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {c.drawerName ?? "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${CHECK_STATUS_STYLE[c.status]}`}
                      >
                        {CHECK_STATUS_LABEL[c.status]}
                      </span>
                      {c.status === "BOUNCED" && c.bounceReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.bounceReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {c.receiptId && c.receiptNumber ? (
                        <Link
                          href={`/treasury/receipts/${c.receiptId}`}
                          className="text-accent hover:underline"
                        >
                          {c.receiptNumber}
                        </Link>
                      ) : c.issuedFromBankAccountId &&
                        c.issuedFromBankAccountName ? (
                        <Link
                          href={`/treasury/banks/${c.issuedFromBankAccountId}`}
                          className="text-accent hover:underline"
                        >
                          {c.issuedFromBankAccountName}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {c.paymentOrderId && c.paymentOrderNumber ? (
                        <>
                          {" → "}
                          <Link
                            href={`/treasury/payment-orders/${c.paymentOrderId}`}
                            className="text-accent hover:underline"
                          >
                            {c.paymentOrderNumber}
                          </Link>
                        </>
                      ) : null}
                      {c.depositedBankAccountId &&
                      c.depositedBankAccountName ? (
                        <>
                          {" → "}
                          <Link
                            href={`/treasury/banks/${c.depositedBankAccountId}`}
                            className="text-accent hover:underline"
                          >
                            {c.depositedBankAccountName}
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td className="py-3">
                      {canManage &&
                      kind === "OWN" &&
                      c.status === "DELIVERED" ? (
                        <DebitOwnCheckButton
                          checkId={c.id}
                          dueDateLabel={
                            c.dueDate
                              ? formatDateAR(c.dueDate)
                              : "sin vto"
                          }
                          dueReached={isDueReached(c.dueDate)}
                          bankLabel={c.issuedFromBankAccountName}
                        />
                      ) : canManage &&
                        kind === "THIRD_PARTY" &&
                        (c.status === "DEPOSITED" ||
                          c.status === "DELIVERED") ? (
                        <BounceCheckButton
                          checkId={c.id}
                          checkLabel={`${c.number} · ${c.bank} · ${formatMoney(c.amount, c.currency)}`}
                          currency={c.currency}
                          status={c.status}
                          drawerName={c.drawerName}
                          allocationTargets={c.allocationTargets}
                          bankAccounts={
                            bankOptionsByCurrency.get(
                              c.currency.toUpperCase(),
                            ) ?? []
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
