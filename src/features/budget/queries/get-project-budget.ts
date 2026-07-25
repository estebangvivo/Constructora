import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { BudgetStatus } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ProjectBudgetView = {
  budgetId: string;
  name: string;
  version: number;
  status: BudgetStatus;
  currency: string;
  notes: string | null;
  items: {
    id: string;
    code: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    actualCost: number;
    actualIncome: number;
  }[];
};

/** Última versión de presupuesto de la obra (o null si no hay). */
export async function getProjectBudget(
  projectId: string,
): Promise<ProjectBudgetView | null> {
  const session = await requireSession();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: { id: true, currency: true },
  });
  if (!project) return null;

  const budget = await prisma.budget.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      },
    },
  });

  if (!budget) return null;

  return {
    budgetId: budget.id,
    name: budget.name,
    version: budget.version,
    status: budget.status,
    currency: budget.currency ?? project.currency,
    notes: budget.notes,
    items: budget.items.map((item) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      quantity: toNumber(item.quantity),
      unit: item.unit,
      unitCost: toNumber(item.unitCost),
      totalCost: toNumber(item.totalCost),
      actualCost: toNumber(item.actualCost),
      actualIncome: toNumber(item.actualIncome),
    })),
  };
}
