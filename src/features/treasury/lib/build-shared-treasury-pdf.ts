import { prisma } from "@/lib/prisma";
import {
  buildTreasuryDocPdf,
  treasuryPdfFilename,
  type TreasuryPdfInput,
} from "@/features/treasury/lib/treasury-pdf";
import type { PdfSharePayload } from "@/features/treasury/lib/pdf-share-token";
import { loadOrganizationLogoBytes } from "@/features/settings/lib/organization-logo";

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

async function loadOrganizationLogo(
  logoUrl: string | null | undefined,
): Promise<TreasuryPdfInput["organizationLogo"]> {
  return loadOrganizationLogoBytes(logoUrl);
}

/** PDF público temporal (token firmado). Sin sesión de usuario. */
export async function buildSharedTreasuryPdfResponse(
  payload: PdfSharePayload,
): Promise<Response> {
  const org = await prisma.organization.findUnique({
    where: { id: payload.organizationId },
    select: {
      name: true,
      taxId: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      logoUrl: true,
    },
  });
  if (!org) {
    return new Response("Organización no encontrada", { status: 404 });
  }

  const logo = await loadOrganizationLogo(org.logoUrl);
  const orgFields = {
    organizationName: org.name,
    organizationTaxId: org.taxId,
    organizationAddress: orgAddress(org),
    organizationLogo: logo,
  };

  if (payload.kind === "receipt") {
    const doc = await prisma.receipt.findFirst({
      where: { id: payload.id, organizationId: payload.organizationId },
      include: {
        client: true,
        payments: {
          orderBy: { sortOrder: "asc" },
          include: {
            bankAccount: { select: { name: true } },
          },
        },
        lines: {
          include: {
            project: { select: { code: true, name: true } },
            budgetItem: { select: { code: true, description: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!doc) return new Response("No encontrado", { status: 404 });

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

    const input: TreasuryPdfInput = {
      kind: "receipt",
      number: doc.number,
      status: doc.status,
      issueDate: doc.issueDate,
      partyName: doc.client?.name ?? doc.partyName ?? "—",
      partyTaxId: doc.client?.taxId ?? null,
      totalAmount: Number(doc.totalAmount),
      currency: doc.currency,
      concept: doc.concept,
      notes: doc.notes,
      ...orgFields,
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
    };

    const bytes = await buildTreasuryDocPdf(input);
    const filename = treasuryPdfFilename("receipt", doc.number);
    return pdfResponse(bytes, filename);
  }

  const doc = await prisma.paymentOrder.findFirst({
    where: { id: payload.id, organizationId: payload.organizationId },
    include: {
      supplier: true,
      payments: {
        orderBy: { sortOrder: "asc" },
        include: {
          bankAccount: { select: { name: true } },
        },
      },
      lines: {
        include: {
          project: { select: { code: true, name: true } },
          budgetItem: { select: { code: true, description: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!doc) return new Response("No encontrado", { status: 404 });

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

  const input: TreasuryPdfInput = {
    kind: "payment-order",
    number: doc.number,
    status: doc.status,
    issueDate: doc.issueDate,
    partyName: doc.supplier?.name ?? doc.partyName ?? "—",
    partyTaxId: doc.supplier?.taxId ?? null,
    totalAmount: Number(doc.totalAmount),
    currency: doc.currency,
    concept: doc.concept,
    notes: doc.notes,
    ...orgFields,
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
  };

  const bytes = await buildTreasuryDocPdf(input);
  const filename = treasuryPdfFilename("payment-order", doc.number);
  return pdfResponse(bytes, filename);
}

function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
