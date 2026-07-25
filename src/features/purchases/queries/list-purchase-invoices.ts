import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { PurchaseInvoiceStatus } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type PurchaseInvoiceListItem = {
  id: string;
  number: string;
  invoiceType: string | null;
  status: PurchaseInvoiceStatus;
  issueDate: Date | null;
  supplierName: string | null;
  supplierTaxId: string | null;
  totalAmount: number;
  currency: string;
  confidencePct: number | null;
  fileName: string;
  createdAt: Date;
};

export type PurchaseInvoiceDetail = {
  id: string;
  projectId: string;
  supplierId: string | null;
  number: string;
  invoiceType: string | null;
  pointOfSale: string | null;
  status: PurchaseInvoiceStatus;
  issueDate: Date | null;
  dueDate: Date | null;
  currency: string;
  netAmount: number;
  taxAmount: number;
  otherTaxes: number;
  totalAmount: number;
  supplierTaxId: string | null;
  supplierName: string | null;
  cae: string | null;
  caeDueDate: Date | null;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  rawText: string | null;
  extractionNotes: string | null;
  confidencePct: number | null;
  notes: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    taxPct: number;
    totalCost: number;
    category: string | null;
  }[];
};

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true, currency: true },
  });
}

export async function listPurchaseInvoices(
  projectId: string,
): Promise<PurchaseInvoiceListItem[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.purchaseInvoice.findMany({
    where: { projectId },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    invoiceType: r.invoiceType,
    status: r.status,
    issueDate: r.issueDate,
    supplierName: r.supplierName,
    supplierTaxId: r.supplierTaxId,
    totalAmount: toNumber(r.totalAmount),
    currency: r.currency,
    confidencePct: r.confidencePct != null ? toNumber(r.confidencePct) : null,
    fileName: r.fileName,
    createdAt: r.createdAt,
  }));
}

export async function getPurchaseInvoiceById(
  invoiceId: string,
): Promise<PurchaseInvoiceDetail | null> {
  const session = await requireSession();
  const row = await prisma.purchaseInvoice.findFirst({
    where: {
      id: invoiceId,
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
      },
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    supplierId: row.supplierId,
    number: row.number,
    invoiceType: row.invoiceType,
    pointOfSale: row.pointOfSale,
    status: row.status,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    currency: row.currency,
    netAmount: toNumber(row.netAmount),
    taxAmount: toNumber(row.taxAmount),
    otherTaxes: toNumber(row.otherTaxes),
    totalAmount: toNumber(row.totalAmount),
    supplierTaxId: row.supplierTaxId,
    supplierName: row.supplierName,
    cae: row.cae,
    caeDueDate: row.caeDueDate,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    rawText: row.rawText,
    extractionNotes: row.extractionNotes,
    confidencePct:
      row.confidencePct != null ? toNumber(row.confidencePct) : null,
    notes: row.notes,
    items: row.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: toNumber(i.quantity),
      unit: i.unit,
      unitCost: toNumber(i.unitCost),
      taxPct: toNumber(i.taxPct),
      totalCost: toNumber(i.totalCost),
      category: i.category,
    })),
  };
}

export async function listProjectSupplierOptions(projectId: string) {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const links = await prisma.projectSupplier.findMany({
    where: { projectId },
    include: {
      supplier: {
        select: { id: true, name: true, taxId: true, isActive: true },
      },
    },
    orderBy: { supplier: { name: "asc" } },
  });

  return links
    .filter((l) => l.supplier.isActive)
    .map((l) => ({
      id: l.supplier.id,
      name: l.supplier.name,
      taxId: l.supplier.taxId,
    }));
}
