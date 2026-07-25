import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { parseLocalDate } from "@/features/schedule/lib/gantt-range";

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export type InventoryItemView = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantityOnHand: number;
  minQuantity: number | null;
  unitCost: number | null;
  location: string | null;
  lowStock: boolean;
};

export type InventoryCategoryGroup = {
  category: string;
  items: InventoryItemView[];
  totalItems: number;
};

export type InventoryMovementView = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reference: string | null;
  notes: string | null;
  occurredAt: Date;
  itemName: string;
  itemCategory: string;
  itemUnit: string;
};

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
}

export async function listInventoryByCategory(
  projectId: string,
): Promise<InventoryCategoryGroup[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.inventoryItem.findMany({
    where: { projectId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const map = new Map<string, InventoryItemView[]>();
  for (const row of rows) {
    const qty = toNumber(row.quantityOnHand);
    const min = row.minQuantity != null ? toNumber(row.minQuantity) : null;
    const item: InventoryItemView = {
      id: row.id,
      name: row.name,
      category: row.category || "General",
      unit: row.unit,
      quantityOnHand: qty,
      minQuantity: min,
      unitCost: row.unitCost != null ? toNumber(row.unitCost) : null,
      location: row.location,
      lowStock: min != null && qty <= min,
    };
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }

  return [...map.entries()].map(([category, items]) => ({
    category,
    items,
    totalItems: items.length,
  }));
}

export async function listConsumptionsForDate(
  projectId: string,
  dateIso: string,
): Promise<InventoryMovementView[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const day = parseLocalDate(dateIso);
  if (!day) return [];
  const next = new Date(day);
  next.setDate(next.getDate() + 1);

  const rows = await prisma.inventoryMovement.findMany({
    where: {
      type: "OUT",
      occurredAt: { gte: day, lt: next },
      inventoryItem: { projectId },
    },
    include: {
      inventoryItem: { select: { name: true, category: true, unit: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    quantity: toNumber(r.quantity),
    reference: r.reference,
    notes: r.notes,
    occurredAt: r.occurredAt,
    itemName: r.inventoryItem.name,
    itemCategory: r.inventoryItem.category,
    itemUnit: r.inventoryItem.unit,
  }));
}
