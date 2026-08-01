import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listCertifiableBudgetItems } from "@/features/certifications/queries/list-certifications";
import { CertificationForm } from "@/features/certifications/components/certification-form";

type PageProps = ProjectRouteParams;

export default async function NewCertificationPage({ params }: PageProps) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  if (!["ADMIN", "DIRECTOR", "RESIDENT"].includes(session.organizationRole)) {
    redirect("/");
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const budgetItems = await listCertifiableBudgetItems(id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/projects/${id}/certifications`}
            className="hover:text-foreground"
          >
            Certificaciones
          </Link>
        </p>
        <h2 className="font-display text-xl tracking-tight">
          Nueva certificación
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Documento interno de avance. No genera factura ARCA.
        </p>
      </div>

      <CertificationForm
        projectId={id}
        currency={project.currency ?? "ARS"}
        budgetItems={budgetItems}
      />
    </div>
  );
}
