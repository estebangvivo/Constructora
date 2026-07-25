import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, ShoppingCart } from "lucide-react";
import type { ProjectRouteParams } from "@/types";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listPurchaseInvoices } from "@/features/purchases/queries/list-purchase-invoices";
import {
  formatPurchaseMoney,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
} from "@/features/purchases/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import { InvoiceUploadForm } from "@/features/purchases/components/invoice-upload-form";

export default async function PurchasesPage({ params }: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const invoices = await listPurchaseInvoices(id);
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  const confirmedTotal = invoices
    .filter((i) => i.status === "CONFIRMED")
    .reduce((a, i) => a + i.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">Compras</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Facturas de proveedores con desglose automático al subir el archivo.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/projects/${id}/purchases/new`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
          >
            <Plus className="size-4" aria-hidden />
            Subir factura
          </Link>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Confirmadas
          </dt>
          <dd className="mt-1 font-display text-xl">
            {formatPurchaseMoney(confirmedTotal, project.currency ?? "ARS")}
          </dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Facturas
          </dt>
          <dd className="mt-1 font-display text-xl">{invoices.length}</dd>
        </div>
      </dl>

      {canManage && invoices.length === 0 && (
        <InvoiceUploadForm projectId={id} />
      )}

      {invoices.length === 0 && !canManage ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <ShoppingCart className="mx-auto mb-2 size-6 opacity-50" aria-hidden />
          Todavía no hay facturas de compra en esta obra.
        </p>
      ) : invoices.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/projects/${id}/purchases/${inv.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {inv.invoiceType ? `Factura ${inv.invoiceType} ` : ""}
                    {inv.number}{" "}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${INVOICE_STATUS_STYLE[inv.status]}`}
                    >
                      {INVOICE_STATUS_LABEL[inv.status]}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {inv.supplierName ?? "Proveedor s/d"}
                    {inv.supplierTaxId ? ` · ${inv.supplierTaxId}` : ""}
                    {inv.issueDate
                      ? ` · ${formatDateAR(inv.issueDate)}`
                      : ""}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-medium tabular-nums">
                    {formatPurchaseMoney(inv.totalAmount, inv.currency)}
                  </p>
                  {inv.confidencePct != null && inv.status === "DRAFT" && (
                    <p className="text-muted-foreground">
                      Lectura {Math.round(inv.confidencePct)}%
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
