import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getPaymentOrderById,
  hasCashMovementForDoc,
} from "@/features/treasury/queries/list-treasury";
import { TreasuryDocActions } from "@/features/treasury/components/treasury-doc-actions";
import {
  formatMoney,
  PAYMENT_METHOD_LABEL,
  TREASURY_STATUS_LABEL,
  TREASURY_STATUS_STYLE,
} from "@/features/treasury/lib/labels";
import { formatDateAR, formatDateTimeAR } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function PaymentOrderDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const doc = await getPaymentOrderById(id);
  if (!doc) notFound();

  const [hasCashMovement, cashMovements] = await Promise.all([
    hasCashMovementForDoc({ paymentOrderId: id }),
    prisma.cashMovement.findMany({
      where: {
        organizationId: session.organizationId,
        paymentOrderId: id,
      },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        type: true,
        amount: true,
        occurredAt: true,
        description: true,
        session: { select: { id: true, number: true } },
      },
    }),
  ]);

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="text-sm text-muted-foreground">
        <Link
          href="/treasury/payment-orders"
          className="hover:text-foreground"
        >
          Órdenes de pago
        </Link>
      </p>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{doc.number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${TREASURY_STATUS_STYLE[doc.status]}`}
            >
              {TREASURY_STATUS_LABEL[doc.status]}
            </span>{" "}
            ·{" "}
            {(doc.payments.length > 0
              ? [...new Set(doc.payments.map((p) => PAYMENT_METHOD_LABEL[p.method]))]
              : [PAYMENT_METHOD_LABEL[doc.paymentMethod]]
            ).join(" + ")}{" "}
            · {formatDateAR(doc.issueDate)}
          </p>
          {doc.paymentMethod === "CASH" &&
            (doc.status === "DRAFT" || doc.status === "ISSUED") && (
              <p className="mt-2 text-sm text-muted-foreground">
                Al imputar, el egreso se registrará en la{" "}
                <Link href="/treasury/cash" className="underline">
                  caja diaria abierta
                </Link>
                .
              </p>
            )}
        </div>
        <TreasuryDocActions
          kind="payment-order"
          id={doc.id}
          status={doc.status}
          paymentMethod={doc.paymentMethod}
          hasCashMovement={hasCashMovement}
        />
      </div>

      <section className="mb-6 space-y-3">
        <h2 className="font-medium">Pago y movimiento</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs uppercase text-muted-foreground">
              Medios de pago
            </dt>
            <dd className="mt-1 space-y-1">
              {(doc.payments.length > 0
                ? doc.payments
                : [
                    {
                      id: "legacy",
                      method: doc.paymentMethod,
                      amount: doc.totalAmount,
                      checkNumber: doc.checkNumber,
                      checkBank: doc.checkBank,
                      checkIssueDate: doc.checkIssueDate,
                      checkDueDate: doc.checkDueDate,
                      checkAccount: doc.checkAccount,
                    },
                  ]
              ).map((p) => (
                <div key={p.id} className="text-sm">
                  <span className="font-medium">
                    {PAYMENT_METHOD_LABEL[p.method]}
                  </span>
                  {" · "}
                  <span className="tabular-nums">
                    {formatMoney(Number(p.amount), doc.currency)}
                  </span>
                  {p.method === "CHECK" && (p.checkNumber || p.checkBank) ? (
                    <span className="text-muted-foreground">
                      {" · "}
                      {[p.checkNumber, p.checkBank].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                  {p.method === "TRANSFER" &&
                  "bankAccount" in p &&
                  p.bankAccount ? (
                    <span className="text-muted-foreground">
                      {" · "}
                      <Link
                        href={`/treasury/banks/${p.bankAccount.id}`}
                        className="text-accent hover:underline"
                      >
                        {p.bankAccount.name}
                      </Link>
                    </span>
                  ) : null}
                </div>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Moneda</dt>
            <dd className="font-medium">{doc.currency}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">
              Fecha del documento
            </dt>
            <dd className="font-medium">{formatDateAR(doc.issueDate)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Estado</dt>
            <dd className="font-medium">{TREASURY_STATUS_LABEL[doc.status]}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">
              Imputado el
            </dt>
            <dd className="font-medium">
              {doc.postedAt ? formatDateTimeAR(doc.postedAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">
              Impacto en caja
            </dt>
            <dd className="font-medium">
              {hasCashMovement
                ? "Registrado en caja diaria (solo porción efectivo)"
                : doc.payments.some((p) => p.method === "CASH") ||
                    doc.paymentMethod === "CASH"
                  ? "Pendiente de caja"
                  : "No aplica (sin efectivo)"}
            </dd>
          </div>
        </dl>

        {cashMovements.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {cashMovements.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {m.description}
                  {m.session ? (
                    <>
                      {" · "}
                      <Link
                        href={`/treasury/cash/sessions/${m.session.id}`}
                        className="underline"
                      >
                        {m.session.number}
                      </Link>
                    </>
                  ) : null}
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatDateTimeAR(m.occurredAt)}
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(Number(m.amount), doc.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="mb-6 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            Beneficiario
          </dt>
          <dd className="font-medium">
            {doc.supplier?.name ?? doc.partyName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Total</dt>
          <dd className="font-display text-xl">
            {formatMoney(Number(doc.totalAmount), doc.currency)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Concepto</dt>
          <dd>{doc.concept ?? "—"}</dd>
        </div>
        {doc.notes && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">Notas</dt>
            <dd>{doc.notes}</dd>
          </div>
        )}
      </dl>

      <h2 className="mb-3 font-medium">Líneas</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Descripción</th>
              <th className="py-2 pr-3 font-medium">Obra</th>
              <th className="py-2 pr-3 font-medium">Partida</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={line.id} className="border-b border-border/70">
                <td className="py-3 pr-3">{line.description}</td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {line.project
                    ? `${line.project.code} · ${line.project.name}`
                    : "—"}
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {line.budgetItem
                    ? `${line.budgetItem.code} · ${line.budgetItem.description}`
                    : "—"}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {formatMoney(Number(line.amount), doc.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
