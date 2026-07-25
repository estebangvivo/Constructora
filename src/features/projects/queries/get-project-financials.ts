import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { normalizeCurrency, sumByCurrency } from "@/config/currencies";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ProjectFinancialSummary = {
  currency: string;
  /** Totales cobrados del cliente por moneda (recibos POSTED). */
  clientPaidByCurrency: Record<string, number>;
  /** Totales pendientes de imputar por moneda. */
  clientPendingByCurrency: Record<string, number>;
  /** Totales egresos imputados por moneda. */
  paidOutByCurrency: Record<string, number>;
  /** Presupuesto estimado (última versión). */
  budgetEstimated: number | null;
  budgetCurrency: string | null;
};

/** Resumen financiero de la obra desde tesorería + presupuesto. */
export async function getProjectFinancialSummary(
  projectId: string,
): Promise<ProjectFinancialSummary | null> {
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

  const [postedReceiptLines, pendingReceiptLines, postedPaymentLines, budget] =
    await Promise.all([
      prisma.receiptLine.findMany({
        where: {
          projectId,
          receipt: {
            organizationId: session.organizationId,
            status: "POSTED",
          },
        },
        select: {
          amount: true,
          receipt: { select: { currency: true } },
        },
      }),
      prisma.receiptLine.findMany({
        where: {
          projectId,
          receipt: {
            organizationId: session.organizationId,
            status: { in: ["DRAFT", "ISSUED"] },
          },
        },
        select: {
          amount: true,
          receipt: { select: { currency: true } },
        },
      }),
      prisma.paymentOrderLine.findMany({
        where: {
          projectId,
          paymentOrder: {
            organizationId: session.organizationId,
            status: "POSTED",
          },
        },
        select: {
          amount: true,
          paymentOrder: { select: { currency: true } },
        },
      }),
      prisma.budget.findFirst({
        where: { projectId },
        orderBy: { version: "desc" },
        include: {
          items: { select: { totalCost: true } },
        },
      }),
    ]);

  const budgetEstimated = budget
    ? budget.items.reduce((acc, item) => acc + toNumber(item.totalCost), 0)
    : null;

  return {
    currency: normalizeCurrency(budget?.currency ?? project.currency),
    clientPaidByCurrency: sumByCurrency(
      postedReceiptLines.map((l) => ({
        currency: l.receipt.currency,
        amount: toNumber(l.amount),
      })),
    ),
    clientPendingByCurrency: sumByCurrency(
      pendingReceiptLines.map((l) => ({
        currency: l.receipt.currency,
        amount: toNumber(l.amount),
      })),
    ),
    paidOutByCurrency: sumByCurrency(
      postedPaymentLines.map((l) => ({
        currency: l.paymentOrder.currency,
        amount: toNumber(l.amount),
      })),
    ),
    budgetEstimated,
    budgetCurrency: budget?.currency ?? project.currency,
  };
}

/** Suma de un mapa de monedas (solo para UI cuando hay una sola moneda). */
export function totalOfCurrencyMap(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}
