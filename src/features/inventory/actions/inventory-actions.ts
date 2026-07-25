"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { parseLocalDate } from "@/features/schedule/lib/gantt-range";
import {
  normalizeInventoryCategory,
  roundQty,
} from "@/features/inventory/lib/labels";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateInventory(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/inventory`);
  revalidatePath(`/projects/${projectId}/daily-report`);
  revalidatePath(`/projects/${projectId}/purchases`);
}

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export async function updateInventoryItemMeta(input: {
  itemId: string;
  category: string;
  minQuantity?: number | null;
  location?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: input.itemId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!item) return { ok: false, error: "Artículo no encontrado." };

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        category: normalizeInventoryCategory(input.category),
        minQuantity:
          input.minQuantity == null || Number.isNaN(Number(input.minQuantity))
            ? null
            : Number(input.minQuantity),
        location: input.location?.trim() || null,
      },
    });

    revalidateInventory(item.projectId);
    return { ok: true, id: item.id };
  } catch (error) {
    console.error("updateInventoryItemMeta", error);
    return { ok: false, error: "No se pudo actualizar." };
  }
}

export async function consumeInventoryItems(input: {
  projectId: string;
  date: string;
  notes?: string;
  lines: { inventoryItemId: string; quantity: number }[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!project) return { ok: false, error: "Obra no encontrada." };

    const day = parseLocalDate(input.date);
    if (!day) return { ok: false, error: "Fecha inválida." };

    const lines = input.lines
      .map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: roundQty(Math.abs(Number(l.quantity) || 0)),
      }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      return { ok: false, error: "Indicá al menos una cantidad a consumir." };
    }

    const dailyReport = await prisma.dailyReport.findFirst({
      where: {
        projectId: project.id,
        reportDate: day,
      },
      select: { id: true },
    });

    const dateLabel = input.date;
    const notes = input.notes?.trim() || null;

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: line.inventoryItemId, projectId: project.id },
        });
        if (!item) {
          throw new Error("Un artículo no pertenece a esta obra.");
        }
        const onHand = toNumber(item.quantityOnHand);
        if (line.quantity > onHand + 0.0001) {
          throw new Error(
            `Stock insuficiente de "${item.name}" (disponible ${onHand} ${item.unit}).`,
          );
        }
        const newQty = roundQty(onHand - line.quantity);
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantityOnHand: newQty },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            type: "OUT",
            quantity: line.quantity,
            reference: `Consumo ${dateLabel}`,
            notes,
            dailyReportId: dailyReport?.id ?? null,
            occurredAt: day,
          },
        });
      }
    });

    revalidateInventory(project.id);
    return { ok: true };
  } catch (error) {
    console.error("consumeInventoryItems", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo registrar el consumo.",
    };
  }
}
