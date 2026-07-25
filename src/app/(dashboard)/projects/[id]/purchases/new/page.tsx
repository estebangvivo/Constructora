import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { InvoiceUploadForm } from "@/features/purchases/components/invoice-upload-form";

export default async function NewPurchaseInvoicePage({
  params,
}: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  if (!["ADMIN", "DIRECTOR", "RESIDENT"].includes(session.organizationRole)) {
    redirect("/");
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/projects/${id}/purchases`}
            className="hover:text-foreground"
          >
            Compras
          </Link>
        </p>
        <h2 className="font-display text-xl tracking-tight">
          Nueva factura de compra
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Subí el PDF o la foto: se desglosan CUIT, montos, CAE y líneas.
        </p>
      </div>
      <InvoiceUploadForm projectId={id} />
    </div>
  );
}
