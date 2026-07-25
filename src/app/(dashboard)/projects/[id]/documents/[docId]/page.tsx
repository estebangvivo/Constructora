import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import {
  getDocumentById,
  listDocumentCategories,
} from "@/features/documents/queries/list-documents";
import { DocumentDetailClient } from "@/features/documents/components/document-detail-client";
import {
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPE_STYLE,
} from "@/features/documents/lib/labels";

type PageProps = {
  params: Promise<{ id: string; docId: string }>;
};

export default async function DocumentDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id: projectId, docId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const document = await getDocumentById(docId);
  if (!document || document.projectId !== projectId) notFound();

  const categories = await listDocumentCategories(projectId);
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/projects/${projectId}/documents`}
            className="hover:text-foreground"
          >
            Documentos
          </Link>
        </p>
        <h2 className="font-display text-xl tracking-tight">
          {document.title}{" "}
          <span
            className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${DOCUMENT_TYPE_STYLE[document.type]}`}
          >
            {DOCUMENT_TYPE_LABEL[document.type]}
          </span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Versión actual v{document.currentVersion}
          {document.uploadedByName
            ? ` · Subido por ${document.uploadedByName}`
            : ""}
        </p>
      </div>

      <DocumentDetailClient
        document={document}
        canManage={canManage}
        categories={categories}
      />
    </div>
  );
}
