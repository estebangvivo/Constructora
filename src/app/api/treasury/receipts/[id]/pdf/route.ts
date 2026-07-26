import { getSession } from "@/lib/auth";
import { buildReceiptPdfResponse } from "@/features/treasury/lib/build-treasury-pdf-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return new Response("No autorizado", { status: 401 });
  }
  const { id } = await context.params;
  return buildReceiptPdfResponse(id);
}
