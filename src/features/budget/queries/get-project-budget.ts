import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { BudgetStatus } from "@prisma/client";
import { normalizeCurrency, sumByCurrency } from "@/config/currencies";
import { tryConvertAmountOnDate } from "@/lib/exchange/convert-on-date";
import { syncBudgetItemsFromTreasury } from "@/features/treasury/lib/helpers";

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
    currency: string;
    /** Montos recibidos en la moneda original del recibo. */
    actualIncomeByCurrency: Record<string, number>;
    /** Equivalente en moneda de la partida (TC a fecha de cada recibo). */
    actualIncome: number;
    /** Montos pagados en la moneda original de la OP. */
    actualCostByCurrency: Record<string, number>;
    /** Equivalente en moneda de la partida (TC a fecha de cada OP). */
    actualCost: number;
    /** true si faltó alguna cotización al convertir. */
    fxIncomplete: boolean;
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

  const budgetCurrency = budget.currency ?? project.currency ?? "ARS";
  const itemIds = budget.items.map((i) => i.id);

  const [receiptLines, paymentLines] = await Promise.all([
    itemIds.length === 0
      ? Promise.resolve([])
      : prisma.receiptLine.findMany({
          where: {
            budgetItemId: { in: itemIds },
            receipt: {
              organizationId: session.organizationId,
              status: "POSTED",
            },
          },
          select: {
            budgetItemId: true,
            amount: true,
            receipt: { select: { currency: true, issueDate: true } },
          },
        }),
    itemIds.length === 0
      ? Promise.resolve([])
      : prisma.paymentOrderLine.findMany({
          where: {
            budgetItemId: { in: itemIds },
            paymentOrder: {
              organizationId: session.organizationId,
              status: "POSTED",
            },
          },
          select: {
            budgetItemId: true,
            amount: true,
            paymentOrder: {
              select: { currency: true, issueDate: true },
            },
          },
        }),
  ]);

  const incomeNative = new Map<string, { currency: string; amount: number }[]>();
  const costNative = new Map<string, { currency: string; amount: number }[]>();

  for (const line of receiptLines) {
    if (!line.budgetItemId) continue;
    const list = incomeNative.get(line.budgetItemId) ?? [];
    list.push({
      currency: line.receipt.currency,
      amount: toNumber(line.amount),
    });
    incomeNative.set(line.budgetItemId, list);
  }

  for (const line of paymentLines) {
    if (!line.budgetItemId) continue;
    const list = costNative.get(line.budgetItemId) ?? [];
    list.push({
      currency: line.paymentOrder.currency,
      amount: toNumber(line.amount),
    });
    costNative.set(line.budgetItemId, list);
  }

  const items = await Promise.all(
    budget.items.map(async (item) => {
      const itemCurrency = normalizeCurrency(item.currency || budgetCurrency);
      const incomeLines = incomeNative.get(item.id) ?? [];
      const costLines = costNative.get(item.id) ?? [];

      let actualIncome = 0;
      let actualCost = 0;
      let fxIncomplete = false;

      const postedIncome = receiptLines.filter(
        (l) => l.budgetItemId === item.id,
      );
      for (const line of postedIncome) {
        const converted = await tryConvertAmountOnDate(
          prisma,
          session.organizationId,
          toNumber(line.amount),
          line.receipt.currency,
          itemCurrency,
          line.receipt.issueDate,
        );
        if (converted == null) {
          fxIncomplete = true;
        } else {
          actualIncome += converted;
        }
      }

      const postedCost = paymentLines.filter((l) => l.budgetItemId === item.id);
      for (const line of postedCost) {
        const converted = await tryConvertAmountOnDate(
          prisma,
          session.organizationId,
          toNumber(line.amount),
          line.paymentOrder.currency,
          itemCurrency,
          line.paymentOrder.issueDate,
        );
        if (converted == null) {
          fxIncomplete = true;
        } else {
          actualCost += converted;
        }
      }

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        quantity: toNumber(item.quantity),
        unit: item.unit,
        unitCost: toNumber(item.unitCost),
        totalCost: toNumber(item.totalCost),
        currency: itemCurrency,
        actualIncomeByCurrency: sumByCurrency(incomeLines),
        actualIncome: Math.round(actualIncome * 100) / 100,
        actualCostByCurrency: sumByCurrency(costLines),
        actualCost: Math.round(actualCost * 100) / 100,
        fxIncomplete,
      };
    }),
  );

  // Autocorregir acumulados en BD (datos históricos sin conversión).
  try {
    await prisma.$transaction((tx) =>
      syncBudgetItemsFromTreasury(tx, session.organizationId, itemIds),
    );
  } catch {
    // Si falta cotización, la UI igual muestra montos nativos + aviso.
  }

  return {
    budgetId: budget.id,
    name: budget.name,
    version: budget.version,
    status: budget.status,
    currency: budgetCurrency,
    notes: budget.notes,
    items,
  };
}
