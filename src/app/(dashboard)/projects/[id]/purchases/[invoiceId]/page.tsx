import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import {
  getPurchaseInvoiceById,
  listProjectSupplierOptions,
} from "@/features/purchases/queries/list-purchase-invoices";
import { InvoiceReviewForm } from "@/features/purchases/components/invoice-review-form";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
} from "@/features/purchases/lib/labels";

type PageProps = {
  params: Promise<{ id: string; invoiceId: string }>;
};

export default async function PurchaseInvoiceDetailPage({
  params,
}: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id: projectId, invoiceId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const invoice = await getPurchaseInvoiceById(invoiceId);
  if (!invoice || invoice.projectId !== projectId) notFound();

  const suppliers = await listProjectSupplierOptions(projectId);
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/projects/${projectId}/purchases`}
            className="hover:text-foreground"
          >
            Compras
          </Link>
        </p>
        <h2 className="font-display text-xl tracking-tight">
          {invoice.invoiceType ? `Factura ${invoice.invoiceType} ` : "Factura "}
          {invoice.number}{" "}
          <span
            className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${INVOICE_STATUS_STYLE[invoice.status]}`}
          >
            {INVOICE_STATUS_LABEL[invoice.status]}
          </span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisá el desglose automático y confirmá los datos.
        </p>
      </div>

      <InvoiceReviewForm
        invoice={invoice}
        suppliers={suppliers}
        canManage={canManage}
      />
    </div>
  );
}
