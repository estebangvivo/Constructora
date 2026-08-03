import { getOrganizationProfile } from "@/features/settings/queries/get-organization";
import { loadOrganizationLogoBytes } from "@/features/settings/lib/organization-logo-server";
import { getCertificationById } from "@/features/certifications/queries/list-certifications";
import {
  buildCertificationPdf,
  certificationPdfFilename,
  type CertificationPdfInput,
} from "@/features/certifications/lib/certification-pdf";

function orgAddress(org: {
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}): string | null {
  const parts = [
    org.address,
    [org.postalCode, org.city].filter(Boolean).join(" "),
    org.province,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export async function buildCertificationPdfResponse(
  certificationId: string,
): Promise<Response> {
  const [cert, org] = await Promise.all([
    getCertificationById(certificationId),
    getOrganizationProfile(),
  ]);
  if (!cert || !org) {
    return new Response("No encontrado", { status: 404 });
  }

  const logo = await loadOrganizationLogoBytes(org.logoUrl);

  const input: CertificationPdfInput = {
    number: cert.number,
    status: cert.status,
    periodStart: cert.periodStart,
    periodEnd: cert.periodEnd,
    currency: cert.currency,
    grossAmount: cert.grossAmount,
    retentionPct: cert.retentionPct,
    retentionAmount: cert.retentionAmount,
    netAmount: cert.netAmount,
    collectedAmount: cert.collectedAmount,
    notes: cert.notes,
    projectCode: cert.project.code,
    projectName: cert.project.name,
    projectAddress: cert.project.address,
    clientName: cert.client?.name ?? null,
    clientTaxId: cert.client?.taxId ?? null,
    organizationName: org.name,
    organizationTaxId: org.taxId,
    organizationAddress: orgAddress(org),
    organizationLogo: logo,
    items: cert.items.map((item) => ({
      code: item.code,
      description: item.description,
      previousPct: item.previousPct,
      currentPct: item.currentPct,
      periodPct: item.periodPct,
      amount: item.amount,
    })),
  };

  const bytes = await buildCertificationPdf(input);
  const filename = certificationPdfFilename(cert.number);

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
