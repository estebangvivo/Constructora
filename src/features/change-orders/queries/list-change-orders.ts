import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { ChangeOrderStatus } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ChangeOrderListItem = {
  id: string;
  number: string;
  title: string;
  status: ChangeOrderStatus;
  amountDelta: number;
  requestedAt: Date;
  decidedAt: Date | null;
  itemCount: number;
};

export type ChangeOrderDetail = {
  id: string;
  projectId: string;
  number: string;
  title: string;
  description: string | null;
  status: ChangeOrderStatus;
  amountDelta: number;
  notes: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  currency: string;
  items: {
    id: string;
    budgetItemId: string | null;
    budgetItemCode: string | null;
    budgetItemDescription: string | null;
    description: string;
    quantityDelta: number;
    unitCostDelta: number;
    amountDelta: number;
  }[];
};

export type BudgetItemOption = {
  id: string;
  code: string;
  description: string;
  totalCost: number;
};

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true, currency: true },
  });
}

export async function listChangeOrders(
  projectId: string,
): Promise<ChangeOrderListItem[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.changeOrder.findMany({
    where: { projectId },
    orderBy: [{ requestedAt: "desc" }, { number: "desc" }],
    include: { _count: { select: { items: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    status: r.status,
    amountDelta: toNumber(r.amountDelta),
    requestedAt: r.requestedAt,
    decidedAt: r.decidedAt,
    itemCount: r._count.items,
  }));
}

export async function getChangeOrderById(
  changeOrderId: string,
): Promise<ChangeOrderDetail | null> {
  const session = await requireSession();
  const row = await prisma.changeOrder.findFirst({
    where: {
      id: changeOrderId,
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
      },
    },
    include: {
      project: { select: { currency: true } },
      items: {
        include: {
          budgetItem: { select: { id: true, code: true, description: true } },
        },
        orderBy: { description: "asc" },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    amountDelta: toNumber(row.amountDelta),
    notes: row.notes,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    currency: row.project.currency,
    items: row.items.map((i) => ({
      id: i.id,
      budgetItemId: i.budgetItemId,
      budgetItemCode: i.budgetItem?.code ?? null,
      budgetItemDescription: i.budgetItem?.description ?? null,
      description: i.description,
      quantityDelta: toNumber(i.quantityDelta),
      unitCostDelta: toNumber(i.unitCostDelta),
      amountDelta: toNumber(i.amountDelta),
    })),
  };
}

export async function listBudgetItemsForChangeOrder(
  projectId: string,
): Promise<BudgetItemOption[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const budget = await prisma.budget.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          description: true,
          totalCost: true,
        },
      },
    },
  });
  if (!budget) return [];

  return budget.items.map((i) => ({
    id: i.id,
    code: i.code,
    description: i.description,
    totalCost: toNumber(i.totalCost),
  }));
}
