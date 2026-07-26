import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { CheckStatus } from "@prisma/client";
import { backfillMissingChecksFromPostedReceipts } from "@/features/treasury/lib/check-portfolio";

export type CheckAllocationTarget = {
  projectId: string;
  projectName: string;
  budgetItemId: string;
  budgetItemLabel: string;
};

export type CheckListItem = {
  id: string;
  number: string;
  bank: string;
  amount: number;
  currency: string;
  issueDate: Date | null;
  dueDate: Date | null;
  account: string | null;
  drawerName: string | null;
  status: CheckStatus;
  bounceReason: string | null;
  bouncedAt: Date | null;
  receiptId: string | null;
  receiptNumber: string | null;
  paymentOrderId: string | null;
  paymentOrderNumber: string | null;
  depositedBankAccountId: string | null;
  depositedBankAccountName: string | null;
  allocationTargets: CheckAllocationTarget[];
  createdAt: Date;
};

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export async function listChecks(opts?: {
  status?: CheckStatus | "ALL";
}): Promise<CheckListItem[]> {
  const session = await requireSession();
  const status = opts?.status ?? "IN_PORTFOLIO";

  // Repara cheques de recibos imputados antes de existir la cartera.
  await prisma.$transaction((tx) =>
    backfillMissingChecksFromPostedReceipts(tx, session.organizationId),
  );

  const rows = await prisma.checkInstrument.findMany({
    where: {
      organizationId: session.organizationId,
      ...(status !== "ALL" ? { status } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    include: {
      receipt: {
        select: {
          id: true,
          number: true,
          lines: {
            select: {
              projectId: true,
              budgetItemId: true,
              project: { select: { name: true, code: true } },
              budgetItem: { select: { code: true, description: true } },
            },
          },
        },
      },
      paymentOrder: { select: { id: true, number: true } },
      depositedBankAccount: { select: { id: true, name: true } },
    },
  });

  return rows.map((c) => {
    const seen = new Set<string>();
    const allocationTargets: CheckAllocationTarget[] = [];
    for (const line of c.receipt?.lines ?? []) {
      if (!line.projectId || !line.budgetItemId || !line.budgetItem) continue;
      const key = `${line.projectId}:${line.budgetItemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allocationTargets.push({
        projectId: line.projectId,
        projectName: line.project
          ? `${line.project.code} · ${line.project.name}`
          : line.projectId,
        budgetItemId: line.budgetItemId,
        budgetItemLabel: `${line.budgetItem.code} · ${line.budgetItem.description}`,
      });
    }

    return {
      id: c.id,
      number: c.number,
      bank: c.bank,
      amount: toNumber(c.amount),
      currency: c.currency,
      issueDate: c.issueDate,
      dueDate: c.dueDate,
      account: c.account,
      drawerName: c.drawerName,
      status: c.status,
      bounceReason: c.bounceReason,
      bouncedAt: c.bouncedAt,
      receiptId: c.receiptId,
      receiptNumber: c.receipt?.number ?? null,
      paymentOrderId: c.paymentOrderId,
      paymentOrderNumber: c.paymentOrder?.number ?? null,
      depositedBankAccountId: c.depositedBankAccountId,
      depositedBankAccountName: c.depositedBankAccount?.name ?? null,
      allocationTargets,
      createdAt: c.createdAt,
    };
  });
}

/** Cheques disponibles para usar en una orden de pago. */
export async function listPortfolioChecksForPayment(): Promise<
  {
    id: string;
    number: string;
    bank: string;
    amount: number;
    currency: string;
    dueDate: string | null;
    drawerName: string | null;
    label: string;
  }[]
> {
  const checks = await listChecks({ status: "IN_PORTFOLIO" });
  return checks.map((c) => ({
    id: c.id,
    number: c.number,
    bank: c.bank,
    amount: c.amount,
    currency: c.currency,
    dueDate: c.dueDate ? c.dueDate.toISOString().slice(0, 10) : null,
    drawerName: c.drawerName,
    label: `${c.number} · ${c.bank} · ${c.amount.toLocaleString("es-AR", {
      style: "currency",
      currency: c.currency,
    })}${c.dueDate ? ` · vto ${c.dueDate.toLocaleDateString("es-AR")}` : ""}`,
  }));
}

function parseDbDate(d: Date): Date {
  // @db.Date llega como medianoche UTC; usamos el día calendario.
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export type CheckDueAlertItem = {
  id: string;
  number: string;
  bank: string;
  amount: number;
  currency: string;
  dueDate: Date;
  drawerName: string | null;
  daysUntilDue: number; // negativo = vencido
};

export type ChecksDueAlert = {
  alertDays: number;
  overdue: CheckDueAlertItem[];
  dueSoon: CheckDueAlertItem[];
  total: number;
};

/** Cheques en cartera vencidos o por vencer según configuración de la org. */
export async function getChecksDueAlert(): Promise<ChecksDueAlert> {
  const session = await requireSession();

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { checkDueAlertDays: true },
  });
  const alertDays = Math.max(0, org?.checkDueAlertDays ?? 7);

  const today = startOfLocalDay();
  const horizon = addLocalDays(today, alertDays);

  const rows = await prisma.checkInstrument.findMany({
    where: {
      organizationId: session.organizationId,
      status: "IN_PORTFOLIO",
      dueDate: {
        not: null,
        lte: new Date(
          Date.UTC(
            horizon.getFullYear(),
            horizon.getMonth(),
            horizon.getDate(),
          ),
        ),
      },
    },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    take: 50,
  });

  const overdue: CheckDueAlertItem[] = [];
  const dueSoon: CheckDueAlertItem[] = [];

  for (const row of rows) {
    if (!row.dueDate) continue;
    const due = parseDbDate(row.dueDate);
    const daysUntilDue = Math.round(
      (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    const item: CheckDueAlertItem = {
      id: row.id,
      number: row.number,
      bank: row.bank,
      amount: toNumber(row.amount),
      currency: row.currency,
      dueDate: row.dueDate,
      drawerName: row.drawerName,
      daysUntilDue,
    };
    if (daysUntilDue < 0) overdue.push(item);
    else dueSoon.push(item);
  }

  return {
    alertDays,
    overdue,
    dueSoon,
    total: overdue.length + dueSoon.length,
  };
}
