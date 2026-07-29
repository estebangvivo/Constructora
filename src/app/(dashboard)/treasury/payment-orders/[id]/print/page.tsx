import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPaymentOrderById } from "@/features/treasury/queries/list-treasury";
import { getOrganizationProfile } from "@/features/settings/queries/get-organization";
import { TreasuryPrintReport } from "@/features/treasury/components/treasury-print-report";
import { PrintReportToolbar } from "@/features/treasury/components/print-report-toolbar";
import { isWhatsAppCloudConfigured } from "@/features/treasury/lib/whatsapp-cloud";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoPrint?: string }>;
};

export default async function PaymentOrderPrintPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const { autoPrint } = await searchParams;
  const [doc, org] = await Promise.all([
    getPaymentOrderById(id),
    getOrganizationProfile(),
  ]);
  if (!doc || !org) notFound();

  const payments =
    doc.payments.length > 0
      ? doc.payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
          checkNumber: p.checkNumber,
          checkBank: p.checkBank,
          bankAccountName: p.bankAccount?.name ?? null,
        }))
      : [
          {
            method: doc.paymentMethod,
            amount: Number(doc.totalAmount),
            checkNumber: doc.checkNumber,
            checkBank: doc.checkBank,
            bankAccountName: null,
          },
        ];

  const partyName = doc.supplier?.name ?? doc.partyName ?? "—";
  const orgAddress = [
    org.address,
    [org.postalCode, org.city].filter(Boolean).join(" "),
    org.province,
  ]
    .filter(Boolean)
    .join(", ");

  const safeNumber = doc.number.replace(/[^\w.-]+/g, "_");
  const cloudEnabled = isWhatsAppCloudConfigured();

  return (
    <div className="min-h-screen bg-[#f3f1ec] print:bg-white">
      <PrintReportToolbar
        backHref={`/treasury/payment-orders/${doc.id}`}
        backLabel="Volver a la orden"
        kind="payment-order"
        documentId={doc.id}
        pdfUrl={`/api/treasury/payment-orders/${doc.id}/pdf`}
        filename={`orden-pago-${safeNumber}.pdf`}
        shareTitle={`Orden de pago ${doc.number}`}
        defaultPhone={doc.supplier?.phone}
        cloudEnabled={cloudEnabled}
        autoPrint={autoPrint === "1"}
      />
      <div className="px-4 py-6 pb-28 print:px-0 print:py-0 sm:pb-6">
        <TreasuryPrintReport
          data={{
            kind: "payment-order",
            number: doc.number,
            status: doc.status,
            issueDate: doc.issueDate,
            partyName,
            partyTaxId: doc.supplier?.taxId,
            totalAmount: Number(doc.totalAmount),
            currency: doc.currency,
            concept: doc.concept,
            notes: doc.notes,
            organizationName: org.name,
            organizationTaxId: org.taxId,
            organizationAddress: orgAddress || null,
            organizationLogoUrl: org.logoUrl,
            payments,
            lines: doc.lines.map((line) => ({
              description: line.description,
              projectLabel: line.project
                ? `${line.project.code} · ${line.project.name}`
                : null,
              budgetItemLabel: line.budgetItem
                ? `${line.budgetItem.code} · ${line.budgetItem.description}`
                : null,
              amount: Number(line.amount),
            })),
          }}
        />
      </div>
    </div>
  );
}
