import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { CertificationStatus } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type CertificationListItem = {
  id: string;
  number: string;
  periodStart: Date;
  periodEnd: Date;
  status: CertificationStatus;
  grossAmount: number;
  retentionPct: number;
  retentionAmount: number;
  netAmount: number;
  itemCount: number;
};

export type CertificationDetail = {
  id: string;
  projectId: string;
  number: string;
  periodStart: Date;
  periodEnd: Date;
  status: CertificationStatus;
  grossAmount: number;
  retentionPct: number;
  retentionAmount: number;
  netAmount: number;
  notes: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  currency: string;
  items: {
    id: string;
    budgetItemId: string;
    code: string;
    description: string;
    totalCost: number;
    previousPct: number;
    currentPct: number;
    periodPct: number;
    amount: number;
  }[];
};

export type CertifiableBudgetItem = {
  id: string;
  code: string;
  description: string;
  totalCost: number;
  previousPct: number;
};

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true, currency: true },
  });
}

export async function listProjectCertifications(
  projectId: string,
): Promise<CertificationListItem[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.certification.findMany({
    where: { projectId },
    orderBy: [{ periodEnd: "desc" }, { number: "desc" }],
    include: { _count: { select: { items: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    status: r.status,
    grossAmount: toNumber(r.grossAmount),
    retentionPct: toNumber(r.retentionPct),
    retentionAmount: toNumber(r.retentionAmount),
    netAmount: toNumber(r.netAmount),
    itemCount: r._count.items,
  }));
}

export async function getCertificationById(
  certificationId: string,
): Promise<CertificationDetail | null> {
  const session = await requireSession();

  const row = await prisma.certification.findFirst({
    where: {
      id: certificationId,
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
      },
    },
    include: {
      project: { select: { id: true, currency: true } },
      items: {
        include: {
          budgetItem: {
            select: {
              id: true,
              code: true,
              description: true,
              totalCost: true,
            },
          },
        },
        orderBy: { budgetItem: { code: "asc" } },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status,
    grossAmount: toNumber(row.grossAmount),
    retentionPct: toNumber(row.retentionPct),
    retentionAmount: toNumber(row.retentionAmount),
    netAmount: toNumber(row.netAmount),
    notes: row.notes,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    paidAt: row.paidAt,
    currency: row.project.currency,
    items: row.items.map((item) => ({
      id: item.id,
      budgetItemId: item.budgetItemId,
      code: item.budgetItem.code,
      description: item.budgetItem.description,
      totalCost: toNumber(item.budgetItem.totalCost),
      previousPct: toNumber(item.previousPct),
      currentPct: toNumber(item.currentPct),
      periodPct: toNumber(item.periodPct),
      amount: toNumber(item.amount),
    })),
  };
}

/**
 * Partidas del último presupuesto + % acumulado de certificaciones
 * aprobadas/liquidadas (base para previousPct).
 */
export async function listCertifiableBudgetItems(
  projectId: string,
): Promise<CertifiableBudgetItem[]> {
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

  const approvedItems = await prisma.certificationItem.findMany({
    where: {
      budgetItemId: { in: budget.items.map((i) => i.id) },
      certification: {
        projectId,
        status: { in: ["APPROVED", "PAID"] },
      },
    },
    select: {
      budgetItemId: true,
      currentPct: true,
    },
  });

  const previousByItem = new Map<string, number>();
  for (const row of approvedItems) {
    const pct = toNumber(row.currentPct);
    const prev = previousByItem.get(row.budgetItemId) ?? 0;
    if (pct > prev) previousByItem.set(row.budgetItemId, pct);
  }

  return budget.items.map((item) => ({
    id: item.id,
    code: item.code,
    description: item.description,
    totalCost: toNumber(item.totalCost),
    previousPct: previousByItem.get(item.id) ?? 0,
  }));
}
