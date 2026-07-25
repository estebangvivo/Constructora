import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { PaymentMethod, TreasuryDocStatus } from "@prisma/client";

export type TreasuryListItem = {
  id: string;
  number: string;
  issueDate: Date;
  status: TreasuryDocStatus;
  paymentMethod: PaymentMethod;
  partyName: string;
  concept: string | null;
  totalAmount: number;
  currency: string;
  projectLabels: string[];
};

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export async function listReceipts(): Promise<TreasuryListItem[]> {
  const session = await requireSession();

  const rows = await prisma.receipt.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: {
      client: { select: { name: true } },
      lines: {
        include: { project: { select: { code: true, name: true } } },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    issueDate: r.issueDate,
    status: r.status,
    paymentMethod: r.paymentMethod,
    partyName: r.client?.name ?? r.partyName ?? "—",
    concept: r.concept,
    totalAmount: toNumber(r.totalAmount),
    currency: r.currency,
    projectLabels: [
      ...new Set(
        r.lines
          .filter((l) => l.project)
          .map((l) => `${l.project!.code} · ${l.project!.name}`),
      ),
    ],
  }));
}

export async function listPaymentOrders(): Promise<TreasuryListItem[]> {
  const session = await requireSession();

  const rows = await prisma.paymentOrder.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: {
      supplier: { select: { name: true } },
      lines: {
        include: { project: { select: { code: true, name: true } } },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    issueDate: r.issueDate,
    status: r.status,
    paymentMethod: r.paymentMethod,
    partyName: r.supplier?.name ?? r.partyName ?? "—",
    concept: r.concept,
    totalAmount: toNumber(r.totalAmount),
    currency: r.currency,
    projectLabels: [
      ...new Set(
        r.lines
          .filter((l) => l.project)
          .map((l) => `${l.project!.code} · ${l.project!.name}`),
      ),
    ],
  }));
}

export async function getReceiptById(id: string) {
  const session = await requireSession();
  return prisma.receipt.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      client: true,
      lines: {
        include: {
          project: { select: { id: true, code: true, name: true } },
          budgetItem: {
            select: { id: true, code: true, description: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getPaymentOrderById(id: string) {
  const session = await requireSession();
  return prisma.paymentOrder.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      supplier: true,
      lines: {
        include: {
          project: { select: { id: true, code: true, name: true } },
          budgetItem: {
            select: { id: true, code: true, description: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/** Partidas del presupuesto activo (última versión) de una obra. */
export async function listBudgetItemsForProject(projectId: string) {
  const session = await requireSession();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });
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
          actualCost: true,
          actualIncome: true,
        },
      },
    },
  });

  return (budget?.items ?? []).map((item) => ({
    id: item.id,
    code: item.code,
    description: item.description,
    totalCost: toNumber(item.totalCost),
    actualCost: toNumber(item.actualCost),
    actualIncome: toNumber(item.actualIncome),
  }));
}
