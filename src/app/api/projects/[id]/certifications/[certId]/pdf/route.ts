import { getSession } from "@/lib/auth";
import { buildCertificationPdfResponse } from "@/features/certifications/lib/build-certification-pdf-response";
import { getCertificationById } from "@/features/certifications/queries/list-certifications";

type RouteContext = {
  params: Promise<{ id: string; certId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id: projectId, certId } = await context.params;
  const cert = await getCertificationById(certId);
  if (!cert || cert.projectId !== projectId) {
    return new Response("No encontrado", { status: 404 });
  }

  return buildCertificationPdfResponse(certId);
}
