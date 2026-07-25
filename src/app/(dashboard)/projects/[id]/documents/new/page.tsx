import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listDocumentCategories } from "@/features/documents/queries/list-documents";
import { DocumentUploadForm } from "@/features/documents/components/document-upload-form";

export default async function NewDocumentPage({ params }: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  if (!["ADMIN", "DIRECTOR", "RESIDENT"].includes(session.organizationRole)) {
    redirect("/");
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const categories = await listDocumentCategories(id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/projects/${id}/documents`}
            className="hover:text-foreground"
          >
            Documentos
          </Link>
        </p>
        <h2 className="font-display text-xl tracking-tight">
          Subir documento
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contratos, planos, especificaciones, informes, fotos u otros.
        </p>
      </div>
      <DocumentUploadForm projectId={id} categories={categories} />
    </div>
  );
}
