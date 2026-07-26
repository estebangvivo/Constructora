import { buildSharedTreasuryPdfResponse } from "@/features/treasury/lib/build-shared-treasury-pdf";
import { verifyPdfShareToken } from "@/features/treasury/lib/pdf-share-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Token requerido", { status: 400 });
  }

  const payload = await verifyPdfShareToken(token);
  if (!payload) {
    return new Response("Enlace inválido o vencido", { status: 401 });
  }

  return buildSharedTreasuryPdfResponse(payload);
}
