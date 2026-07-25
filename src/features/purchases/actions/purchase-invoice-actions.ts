"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { saveProjectUploadFile } from "@/lib/uploads";
import { extractInvoiceFromFile } from "@/features/purchases/lib/invoice-extract";
import { parseLocalDate } from "@/features/schedule/lib/gantt-range";
import { digitsOnly } from "@/lib/arca/tax-id";
import { normalizeCurrency } from "@/config/currencies";
import { stockInFromPurchaseInvoice } from "@/features/inventory/lib/stock-from-invoice";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  taxPct: number;
  totalCost: number;
  category?: string;
};

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidatePurchases(projectId: string, invoiceId?: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/purchases`);
  if (invoiceId) {
    revalidatePath(`/projects/${projectId}/purchases/${invoiceId}`);
  }
}

async function assertProject(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

function optionalDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  return parseLocalDate(value.trim());
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function matchSupplierByCuit(
  organizationId: string,
  projectId: string,
  taxId: string | null,
) {
  if (!taxId) return null;
  const digits = digitsOnly(taxId);
  if (digits.length < 8) return null;

  const suppliers = await prisma.supplier.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { taxId: { contains: digits } },
        { taxId: { contains: taxId } },
      ],
    },
    select: { id: true, taxId: true },
    take: 10,
  });

  const exact = suppliers.find(
    (s) => s.taxId && digitsOnly(s.taxId) === digits,
  );
  if (!exact) return null;

  const linked = await prisma.projectSupplier.findFirst({
    where: { projectId, supplierId: exact.id },
  });
  if (!linked) {
    await prisma.projectSupplier.create({
      data: { projectId, supplierId: exact.id, roleNotes: "Factura de compra" },
    });
  }
  return exact.id;
}

export async function uploadPurchaseInvoice(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const projectId =
      typeof formData.get("projectId") === "string"
        ? String(formData.get("projectId"))
        : "";
    if (!projectId) return { ok: false, error: "Obra inválida." };
    await assertProject(projectId, session.organizationId);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "Subí la factura (PDF o imagen)." };
    }

    const saved = await saveProjectUploadFile({
      projectId,
      file,
      folder: "invoices",
      allowedKinds: "invoices",
    });

    const extracted = await extractInvoiceFromFile({
      buffer: saved.buffer,
      mimeType: saved.mimeType,
      fileName: saved.fileName,
    });

    // Evitar choque de unique (projectId, number)
    let number = extracted.number;
    const exists = await prisma.purchaseInvoice.findFirst({
      where: { projectId, number },
      select: { id: true },
    });
    if (exists) {
      number = `${number}-${Date.now().toString().slice(-4)}`;
    }

    const supplierId = await matchSupplierByCuit(
      session.organizationId,
      projectId,
      extracted.supplierTaxId,
    );

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        projectId,
        supplierId,
        number,
        invoiceType: extracted.invoiceType,
        pointOfSale: extracted.pointOfSale,
        status: "DRAFT",
        issueDate: optionalDate(extracted.issueDate ?? undefined),
        dueDate: optionalDate(extracted.dueDate ?? undefined),
        currency: normalizeCurrency(extracted.currency),
        netAmount: extracted.netAmount,
        taxAmount: extracted.taxAmount,
        otherTaxes: extracted.otherTaxes,
        totalAmount: extracted.totalAmount,
        supplierTaxId: extracted.supplierTaxId,
        supplierName: extracted.supplierName,
        cae: extracted.cae,
        caeDueDate: optionalDate(extracted.caeDueDate ?? undefined),
        fileUrl: saved.fileUrl,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        rawText: extracted.rawText || null,
        extractionNotes: extracted.notes.join(" · ") || null,
        confidencePct: extracted.confidencePct,
        items: {
          create: extracted.lines.map((line, index) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitCost: line.unitCost,
            taxPct: line.taxPct,
            totalCost: line.totalCost,
            sortOrder: index,
          })),
        },
      },
    });

    revalidatePurchases(projectId, invoice.id);
    return { ok: true, id: invoice.id };
  } catch (error) {
    console.error("uploadPurchaseInvoice", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo procesar la factura.",
    };
  }
}

export async function updatePurchaseInvoice(input: {
  invoiceId: string;
  number: string;
  invoiceType?: string;
  pointOfSale?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  netAmount: number;
  taxAmount: number;
  otherTaxes: number;
  totalAmount: number;
  supplierTaxId?: string;
  supplierName?: string;
  supplierId?: string | null;
  cae?: string;
  caeDueDate?: string;
  notes?: string;
  lines: InvoiceLineInput[];
  confirm?: boolean;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.purchaseInvoice.findFirst({
      where: {
        id: input.invoiceId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Factura no encontrada." };
    if (existing.status === "CANCELLED") {
      return { ok: false, error: "La factura está anulada." };
    }

    if (existing.status === "CONFIRMED") {
      return {
        ok: false,
        error:
          "La factura ya está confirmada e impactó el inventario. Anulala si necesitás corregir.",
      };
    }

    const number = input.number.trim();
    if (!number) return { ok: false, error: "El número es obligatorio." };

    const clash = await prisma.purchaseInvoice.findFirst({
      where: {
        projectId: existing.projectId,
        number,
        NOT: { id: existing.id },
      },
    });
    if (clash) {
      return { ok: false, error: "Ya existe otra factura con ese número." };
    }

    const lines = input.lines
      .map((l, index) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity) || 0,
        unit: l.unit?.trim() || "u",
        unitCost: round2(Number(l.unitCost) || 0),
        taxPct: round2(Number(l.taxPct) || 0),
        totalCost: round2(
          Number(l.totalCost) ||
            (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
        ),
        category: l.category?.trim() || null,
        sortOrder: index,
      }))
      .filter((l) => l.description.length > 0);

    if (lines.length === 0) {
      return { ok: false, error: "Agregá al menos una línea." };
    }

    let supplierId = input.supplierId || null;
    if (!supplierId && input.supplierTaxId) {
      supplierId = await matchSupplierByCuit(
        session.organizationId,
        existing.projectId,
        input.supplierTaxId,
      );
    }

    const becomingConfirmed = Boolean(input.confirm);

    await prisma.$transaction(async (tx) => {
      await tx.purchaseInvoiceItem.deleteMany({
        where: { purchaseInvoiceId: existing.id },
      });
      await tx.purchaseInvoice.update({
        where: { id: existing.id },
        data: {
          number,
          invoiceType: input.invoiceType?.trim() || null,
          pointOfSale: input.pointOfSale?.trim() || null,
          issueDate: optionalDate(input.issueDate),
          dueDate: optionalDate(input.dueDate),
          currency: normalizeCurrency(input.currency),
          netAmount: round2(input.netAmount),
          taxAmount: round2(input.taxAmount),
          otherTaxes: round2(input.otherTaxes),
          totalAmount: round2(input.totalAmount),
          supplierTaxId: input.supplierTaxId?.trim() || null,
          supplierName: input.supplierName?.trim() || null,
          supplierId,
          cae: input.cae?.trim() || null,
          caeDueDate: optionalDate(input.caeDueDate),
          notes: input.notes?.trim() || null,
          status: becomingConfirmed ? "CONFIRMED" : existing.status,
          items: { create: lines },
        },
      });

      if (becomingConfirmed) {
        await stockInFromPurchaseInvoice(tx, existing.id);
      }
    });

    revalidatePurchases(existing.projectId, existing.id);
    revalidatePath(`/projects/${existing.projectId}/inventory`);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("updatePurchaseInvoice", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function setPurchaseInvoiceStatus(input: {
  invoiceId: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.purchaseInvoice.findFirst({
      where: {
        id: input.invoiceId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Factura no encontrada." };

    if (existing.status === "CONFIRMED" && input.status === "CONFIRMED") {
      return { ok: true, id: existing.id };
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseInvoice.update({
        where: { id: existing.id },
        data: { status: input.status },
      });
      if (input.status === "CONFIRMED") {
        await stockInFromPurchaseInvoice(tx, existing.id);
      }
    });

    revalidatePurchases(existing.projectId, existing.id);
    revalidatePath(`/projects/${existing.projectId}/inventory`);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("setPurchaseInvoiceStatus", error);
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

export async function deletePurchaseInvoice(
  invoiceId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.purchaseInvoice.findFirst({
      where: {
        id: invoiceId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Factura no encontrada." };
    if (existing.status === "CONFIRMED") {
      return {
        ok: false,
        error: "Anulá la factura confirmada antes de eliminarla.",
      };
    }

    await prisma.purchaseInvoice.delete({ where: { id: existing.id } });
    revalidatePurchases(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("deletePurchaseInvoice", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}
