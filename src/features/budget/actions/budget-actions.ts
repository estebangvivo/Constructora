"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { normalizeCurrency } from "@/config/currencies";
import type { BudgetStatus } from "@prisma/client";

export type BudgetItemInput = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  /** Moneda de la partida: ARS (pesos) o USD (dólares). */
  currency?: string;
};

export type ActionResult =
  | { ok: true; budgetId?: string; itemId?: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateBudget(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath("/treasury");
}

async function assertProjectInOrg(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true, currency: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

async function getEditableBudget(budgetId: string, organizationId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      project: { organizationId, deletedAt: null },
    },
    include: { project: { select: { id: true } } },
  });
  if (!budget) throw new Error("Presupuesto no encontrado.");
  if (budget.status === "LOCKED") {
    throw new Error("El presupuesto está cerrado y no se puede editar.");
  }
  return budget;
}

function normalizeItem(input: BudgetItemInput, fallbackCurrency = "ARS") {
  const code = input.code.trim();
  const description = input.description.trim();
  const unit = input.unit.trim() || "u";
  const quantity = Number(input.quantity);
  const unitCost = Number(input.unitCost);
  const currency = normalizeCurrency(input.currency || fallbackCurrency);

  if (!code || !description) {
    throw new Error("Código y descripción son obligatorios.");
  }
  if (!(quantity >= 0) || Number.isNaN(quantity)) {
    throw new Error("La cantidad no es válida.");
  }
  if (!(unitCost >= 0) || Number.isNaN(unitCost)) {
    throw new Error("El costo unitario no es válido.");
  }

  const totalCost = Number((quantity * unitCost).toFixed(2));
  return { code, description, unit, quantity, unitCost, totalCost, currency };
}

export async function createBudget(input: {
  projectId: string;
  name: string;
  currency?: string;
  notes?: string;
  items?: BudgetItemInput[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para crear presupuestos." };
    }

    const project = await assertProjectInOrg(
      input.projectId,
      session.organizationId,
    );

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    const existing = await prisma.budget.count({
      where: { projectId: project.id },
    });
    if (existing > 0) {
      return {
        ok: false,
        error: "Esta obra ya tiene presupuesto. Agregá o editá partidas.",
      };
    }

    const budgetCurrency =
      input.currency?.trim() || project.currency || "ARS";
    const rawItems = (input.items ?? []).filter(
      (i) => i.code.trim() && i.description.trim(),
    );
    const items = rawItems.map((i) => normalizeItem(i, budgetCurrency));

    const budget = await prisma.budget.create({
      data: {
        projectId: project.id,
        name,
        version: 1,
        status: "DRAFT",
        currency: budgetCurrency,
        notes: input.notes?.trim() || null,
        items: {
          create: items.map((item, index) => ({
            ...item,
            sortOrder: index,
          })),
        },
      },
    });

    revalidateBudget(project.id);
    return { ok: true, budgetId: budget.id };
  } catch (error) {
    console.error("createBudget", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear el presupuesto.",
    };
  }
}

export async function updateBudgetMeta(input: {
  budgetId: string;
  name: string;
  currency?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const budget = await getEditableBudget(
      input.budgetId,
      session.organizationId,
    );
    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    await prisma.budget.update({
      where: { id: budget.id },
      data: {
        name,
        currency: input.currency?.trim() || budget.currency,
        notes: input.notes?.trim() || null,
      },
    });

    revalidateBudget(budget.project.id);
    return { ok: true, budgetId: budget.id };
  } catch (error) {
    console.error("updateBudgetMeta", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function setBudgetStatus(input: {
  budgetId: string;
  status: Extract<BudgetStatus, "DRAFT" | "APPROVED" | "LOCKED">;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const budget = await prisma.budget.findFirst({
      where: {
        id: input.budgetId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
      include: { project: { select: { id: true } }, _count: { select: { items: true } } },
    });
    if (!budget) return { ok: false, error: "Presupuesto no encontrado." };

    if (input.status === "APPROVED" && budget._count.items === 0) {
      return {
        ok: false,
        error: "Agregá al menos una partida antes de aprobar.",
      };
    }

    if (budget.status === "LOCKED" && input.status !== "LOCKED") {
      if (!["ADMIN", "DIRECTOR"].includes(session.organizationRole)) {
        return { ok: false, error: "Solo admin/director puede reabrir." };
      }
    }

    await prisma.budget.update({
      where: { id: budget.id },
      data: {
        status: input.status,
        approvedAt:
          input.status === "APPROVED" ? new Date() : budget.approvedAt,
      },
    });

    revalidateBudget(budget.project.id);
    return { ok: true, budgetId: budget.id };
  } catch (error) {
    console.error("setBudgetStatus", error);
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

export async function addBudgetItem(input: {
  budgetId: string;
  item: BudgetItemInput;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const budget = await getEditableBudget(
      input.budgetId,
      session.organizationId,
    );
    const item = normalizeItem(
      input.item,
      budget.currency ?? "ARS",
    );

    const last = await prisma.budgetItem.findFirst({
      where: { budgetId: budget.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await prisma.budgetItem.create({
      data: {
        budgetId: budget.id,
        ...item,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });

    revalidateBudget(budget.project.id);
    return { ok: true, budgetId: budget.id, itemId: created.id };
  } catch (error) {
    console.error("addBudgetItem", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo agregar la partida.",
    };
  }
}

export async function updateBudgetItem(input: {
  itemId: string;
  item: BudgetItemInput;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.budgetItem.findFirst({
      where: {
        id: input.itemId,
        budget: {
          project: {
            organizationId: session.organizationId,
            deletedAt: null,
          },
        },
      },
      include: {
        budget: { include: { project: { select: { id: true } } } },
      },
    });
    if (!existing) return { ok: false, error: "Partida no encontrada." };
    if (existing.budget.status === "LOCKED") {
      return { ok: false, error: "El presupuesto está cerrado." };
    }

    const item = normalizeItem(
      input.item,
      existing.budget.currency ?? "ARS",
    );
    await prisma.budgetItem.update({
      where: { id: existing.id },
      data: item,
    });

    revalidateBudget(existing.budget.project.id);
    return { ok: true, itemId: existing.id, budgetId: existing.budgetId };
  } catch (error) {
    console.error("updateBudgetItem", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la partida.",
    };
  }
}

export async function deleteBudgetItem(itemId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.budgetItem.findFirst({
      where: {
        id: itemId,
        budget: {
          project: {
            organizationId: session.organizationId,
            deletedAt: null,
          },
        },
      },
      include: {
        budget: { include: { project: { select: { id: true } } } },
        _count: {
          select: {
            receiptLines: true,
            paymentOrderLines: true,
          },
        },
      },
    });
    if (!existing) return { ok: false, error: "Partida no encontrada." };
    if (existing.budget.status === "LOCKED") {
      return { ok: false, error: "El presupuesto está cerrado." };
    }
    if (
      existing._count.receiptLines > 0 ||
      existing._count.paymentOrderLines > 0
    ) {
      return {
        ok: false,
        error:
          "No se puede eliminar: tiene recibos u órdenes de pago imputados.",
      };
    }

    await prisma.budgetItem.delete({ where: { id: existing.id } });
    revalidateBudget(existing.budget.project.id);
    return { ok: true, itemId: existing.id, budgetId: existing.budgetId };
  } catch (error) {
    console.error("deleteBudgetItem", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la partida.",
    };
  }
}
