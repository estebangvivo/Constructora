"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { round2, round4 } from "@/features/change-orders/lib/labels";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type ChangeOrderLineInput = {
  budgetItemId?: string | null;
  description: string;
  quantityDelta: number;
  unitCostDelta: number;
  amountDelta: number;
};

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function canDecide(role: string) {
  return ["ADMIN", "DIRECTOR"].includes(role);
}

function revalidateCo(projectId: string, coId?: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/change-orders`);
  revalidatePath(`/projects/${projectId}/budget`);
  if (coId) revalidatePath(`/projects/${projectId}/change-orders/${coId}`);
}

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

async function assertProject(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

async function nextCoNumber(projectId: string, tx: Prisma.TransactionClient) {
  const last = await tx.changeOrder.findFirst({
    where: { projectId, number: { startsWith: "ODC-" } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.replace("ODC-", "")) + 1 : 1;
  const safe = Number.isFinite(seq) && seq > 0 ? seq : 1;
  return `ODC-${String(safe).padStart(4, "0")}`;
}

function normalizeLines(lines: ChangeOrderLineInput[]) {
  const normalized = lines
    .map((l) => {
      const description = l.description.trim();
      const quantityDelta = round4(Number(l.quantityDelta) || 0);
      const unitCostDelta = round2(Number(l.unitCostDelta) || 0);
      let amountDelta = round2(Number(l.amountDelta) || 0);
      if (amountDelta === 0 && (quantityDelta !== 0 || unitCostDelta !== 0)) {
        // si no cargaron monto, estimar por deltas (aproximado)
        amountDelta = round2(quantityDelta * unitCostDelta);
      }
      return {
        budgetItemId: l.budgetItemId || null,
        description,
        quantityDelta,
        unitCostDelta,
        amountDelta,
      };
    })
    .filter((l) => l.description.length > 0);

  if (normalized.length === 0) {
    throw new Error("Agregá al menos una línea de impacto.");
  }
  return normalized;
}

export async function createChangeOrder(input: {
  projectId: string;
  title: string;
  description?: string;
  notes?: string;
  lines: ChangeOrderLineInput[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }
    await assertProject(input.projectId, session.organizationId);

    const title = input.title.trim();
    if (!title) return { ok: false, error: "El título es obligatorio." };

    const lines = normalizeLines(input.lines);
    const amountDelta = round2(lines.reduce((a, l) => a + l.amountDelta, 0));

    const co = await prisma.$transaction(async (tx) => {
      const number = await nextCoNumber(input.projectId, tx);
      return tx.changeOrder.create({
        data: {
          projectId: input.projectId,
          createdById: session.user.id,
          number,
          title,
          description: input.description?.trim() || null,
          notes: input.notes?.trim() || null,
          status: "PENDING",
          amountDelta,
          items: { create: lines },
        },
      });
    });

    revalidateCo(input.projectId, co.id);
    return { ok: true, id: co.id };
  } catch (error) {
    console.error("createChangeOrder", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear.",
    };
  }
}

export async function updateChangeOrder(input: {
  changeOrderId: string;
  title: string;
  description?: string;
  notes?: string;
  lines: ChangeOrderLineInput[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.changeOrder.findFirst({
      where: {
        id: input.changeOrderId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "ODC no encontrada." };
    if (existing.status !== "PENDING") {
      return { ok: false, error: "Solo se editan ODC pendientes." };
    }

    const title = input.title.trim();
    if (!title) return { ok: false, error: "El título es obligatorio." };
    const lines = normalizeLines(input.lines);
    const amountDelta = round2(lines.reduce((a, l) => a + l.amountDelta, 0));

    await prisma.$transaction(async (tx) => {
      await tx.changeOrderItem.deleteMany({
        where: { changeOrderId: existing.id },
      });
      await tx.changeOrder.update({
        where: { id: existing.id },
        data: {
          title,
          description: input.description?.trim() || null,
          notes: input.notes?.trim() || null,
          amountDelta,
          items: { create: lines },
        },
      });
    });

    revalidateCo(existing.projectId, existing.id);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("updateChangeOrder", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

async function applyChangeOrderToBudget(
  tx: Prisma.TransactionClient,
  projectId: string,
  changeOrderId: string,
) {
  const co = await tx.changeOrder.findUniqueOrThrow({
    where: { id: changeOrderId },
    include: { items: true },
  });

  const linked = co.items.filter((i) => i.budgetItemId);
  if (linked.length === 0) return;

  const budget = await tx.budget.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
  if (!budget) {
    throw new Error("La obra no tiene presupuesto para aplicar la ODC.");
  }
  if (budget.status === "LOCKED") {
    throw new Error("El presupuesto está cerrado. Reabrilo antes de aprobar.");
  }

  for (const line of linked) {
    const item = await tx.budgetItem.findFirst({
      where: { id: line.budgetItemId!, budgetId: budget.id },
    });
    if (!item) {
      throw new Error("Una partida de la ODC no pertenece al presupuesto.");
    }

    const quantity = round4(
      toNumber(item.quantity) + toNumber(line.quantityDelta),
    );
    let unitCost = round2(
      toNumber(item.unitCost) + toNumber(line.unitCostDelta),
    );
    let totalCost = round2(
      toNumber(item.totalCost) + toNumber(line.amountDelta),
    );

    if (quantity > 0 && toNumber(line.amountDelta) !== 0) {
      unitCost = round2(totalCost / quantity);
    } else if (quantity >= 0 && toNumber(line.amountDelta) === 0) {
      totalCost = round2(quantity * unitCost);
    }

    await tx.budgetItem.update({
      where: { id: item.id },
      data: {
        quantity: Math.max(0, quantity),
        unitCost: Math.max(0, unitCost),
        totalCost: round2(totalCost),
      },
    });
  }

  await tx.budget.update({
    where: { id: budget.id },
    data: {
      status: "REVISED",
      notes: [budget.notes, `ODC ${co.number} aprobada`]
        .filter(Boolean)
        .join(" · "),
    },
  });
}

export async function setChangeOrderStatus(input: {
  changeOrderId: string;
  status: "APPROVED" | "REJECTED";
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canDecide(session.organizationRole)) {
      return { ok: false, error: "Solo dirección puede aprobar o rechazar." };
    }

    const existing = await prisma.changeOrder.findFirst({
      where: {
        id: input.changeOrderId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) return { ok: false, error: "ODC no encontrada." };
    if (existing.status !== "PENDING") {
      return { ok: false, error: "La ODC ya fue decidida." };
    }
    if (existing._count.items === 0) {
      return { ok: false, error: "La ODC no tiene líneas." };
    }

    const decidedBy =
      [session.user.firstName, session.user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || session.user.email;

    await prisma.$transaction(async (tx) => {
      if (input.status === "APPROVED") {
        await applyChangeOrderToBudget(tx, existing.projectId, existing.id);
      }
      await tx.changeOrder.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          decidedAt: new Date(),
          decidedBy,
        },
      });
    });

    revalidateCo(existing.projectId, existing.id);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("setChangeOrderStatus", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo cambiar el estado.",
    };
  }
}

export async function deleteChangeOrder(
  changeOrderId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.changeOrder.findFirst({
      where: {
        id: changeOrderId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "ODC no encontrada." };
    if (existing.status !== "PENDING") {
      return { ok: false, error: "Solo se eliminan ODC pendientes." };
    }

    await prisma.changeOrder.delete({ where: { id: existing.id } });
    revalidateCo(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("deleteChangeOrder", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}
