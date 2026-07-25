import type { Prisma } from "@prisma/client";
import {
  normalizeInventoryCategory,
  normalizeInventoryName,
  roundQty,
} from "@/features/inventory/lib/labels";

type Tx = Prisma.TransactionClient;

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

/**
 * Ingresa al inventario de la obra las líneas de una factura confirmada.
 * Agrupa por nombre (case-insensitive) + unidad + categoría.
 */
export async function stockInFromPurchaseInvoice(
  tx: Tx,
  invoiceId: string,
): Promise<void> {
  const invoice = await tx.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice || invoice.status !== "CONFIRMED") return;

  // Evitar doble ingreso si ya hay movimientos IN de esta factura
  const already = await tx.inventoryMovement.count({
    where: { purchaseInvoiceId: invoice.id, type: "IN" },
  });
  if (already > 0) return;

  for (const line of invoice.items) {
    const qty = toNumber(line.quantity);
    if (qty <= 0) continue;

    const name = normalizeInventoryName(line.description);
    if (!name) continue;
    const category = normalizeInventoryCategory(line.category);
    const unit = line.unit?.trim() || "u";
    const unitCost = toNumber(line.unitCost);

    const existing = await tx.inventoryItem.findFirst({
      where: {
        projectId: invoice.projectId,
        unit,
        category,
        name: { equals: name, mode: "insensitive" },
      },
    });

    let itemId: string;
    if (existing) {
      const newQty = roundQty(toNumber(existing.quantityOnHand) + qty);
      await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          quantityOnHand: newQty,
          unitCost: unitCost > 0 ? unitCost : existing.unitCost,
        },
      });
      itemId = existing.id;
    } else {
      const created = await tx.inventoryItem.create({
        data: {
          projectId: invoice.projectId,
          name,
          category,
          unit,
          quantityOnHand: qty,
          unitCost: unitCost > 0 ? unitCost : null,
        },
      });
      itemId = created.id;
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryItemId: itemId,
        type: "IN",
        quantity: qty,
        reference: `Factura ${invoice.number}`,
        notes: line.description,
        purchaseInvoiceId: invoice.id,
        purchaseInvoiceItemId: line.id,
        occurredAt: invoice.issueDate ?? new Date(),
      },
    });

    await tx.purchaseInvoiceItem.update({
      where: { id: line.id },
      data: { inventoryItemId: itemId, category },
    });
  }
}
