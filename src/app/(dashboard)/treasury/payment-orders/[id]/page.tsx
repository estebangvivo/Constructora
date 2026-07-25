import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPaymentOrderById } from "@/features/treasury/queries/list-treasury";
import { TreasuryDocActions } from "@/features/treasury/components/treasury-doc-actions";
import {
  formatMoney,
  PAYMENT_METHOD_LABEL,
  TREASURY_STATUS_LABEL,
  TREASURY_STATUS_STYLE,
} from "@/features/treasury/lib/labels";
import { formatDateAR } from "@/lib/format-date";

type PageProps = { params: Promise<{ id: string }> };

export default async function PaymentOrderDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const doc = await getPaymentOrderById(id);
  if (!doc) notFound();

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
            · {PAYMENT_METHOD_LABEL[doc.paymentMethod]} ·{" "}
            {formatDateAR(doc.issueDate)}
          </p>
          {doc.paymentMethod === "CASH" &&
            (doc.status === "DRAFT" || doc.status === "ISSUED") && (
              <p className="mt-2 text-sm text-muted-foreground">
                Al imputar, el egreso se registrará en la{" "}
                <Link href="/treasury/cash" className="text-accent underline">
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
        />
      </div>

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
        {doc.paymentMethod === "CHECK" && (
          <>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">
                N° cheque
              </dt>
              <dd className="font-medium">{doc.checkNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Banco</dt>
              <dd className="font-medium">{doc.checkBank ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">
                Emisión cheque
              </dt>
              <dd>
                {doc.checkIssueDate
                  ? formatDateAR(doc.checkIssueDate)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">
                Cobro / vencimiento
              </dt>
              <dd>
                {doc.checkDueDate
                  ? formatDateAR(doc.checkDueDate)
                  : "—"}
              </dd>
            </div>
            {doc.checkAccount && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-muted-foreground">
                  Cuenta / sucursal
                </dt>
                <dd>{doc.checkAccount}</dd>
              </div>
            )}
          </>
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
