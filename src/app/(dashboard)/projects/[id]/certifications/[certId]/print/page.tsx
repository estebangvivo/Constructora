import { notFound, redirect } from "next/navigation";
import { getOrganizationSession } from "@/lib/auth";
import { getCertificationById } from "@/features/certifications/queries/list-certifications";
import { getOrganizationProfile } from "@/features/settings/queries/get-organization";
import { CertificationPrintReport } from "@/features/certifications/components/certification-print-report";
import { CertificationPrintToolbar } from "@/features/certifications/components/certification-print-toolbar";
import { certificationPdfFilename } from "@/features/certifications/lib/certification-pdf";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; certId: string }>;
  searchParams: Promise<{ autoPrint?: string }>;
};

export default async function CertificationPrintPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id: projectId, certId } = await params;
  const { autoPrint } = await searchParams;

  const [cert, org] = await Promise.all([
    getCertificationById(certId),
    getOrganizationProfile(),
  ]);
  if (!cert || cert.projectId !== projectId || !org) notFound();

  const orgAddress = [
    org.address,
    [org.postalCode, org.city].filter(Boolean).join(" "),
    org.province,
  ]
    .filter(Boolean)
    .join(", ");

  const pdfUrl = `/api/projects/${projectId}/certifications/${certId}/pdf`;
  const filename = certificationPdfFilename(cert.number);

  return (
    <div className="min-h-screen bg-[#f3f1ec] print:bg-white">
      <CertificationPrintToolbar
        backHref={`/projects/${projectId}/certifications/${certId}`}
        pdfUrl={pdfUrl}
        filename={filename}
        autoPrint={autoPrint === "1"}
      />
      <div className="px-4 py-6 pb-28 print:px-0 print:py-0 sm:pb-6">
        <CertificationPrintReport
          data={{
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
            organizationAddress: orgAddress || null,
            organizationLogoUrl: org.logoUrl,
            items: cert.items.map((item) => ({
              code: item.code,
              description: item.description,
              previousPct: item.previousPct,
              currentPct: item.currentPct,
              periodPct: item.periodPct,
              amount: item.amount,
            })),
          }}
        />
      </div>
    </div>
  );
}
