import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { normalizeCurrency, sumByCurrency } from "@/config/currencies";
import { tryConvertAmountOnDate } from "@/lib/exchange/convert-on-date";

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
  /**
   * Cobrado convertido a `currency` (TC a fecha de cada recibo).
   * Para gráficos vs presupuesto.
   */
  clientPaidConverted: number;
  /** Pagado convertido a `currency` (TC a fecha de cada OP). */
  paidOutConverted: number;
  /** Presupuesto estimado convertido a `currency`. */
  budgetEstimated: number | null;
  budgetCurrency: string | null;
  /** Promedio de avance de tareas del cronograma (0–100). */
  scheduleProgressPct: number;
  /** Costo real acumulado en partidas (actualCost, ya en moneda de partida). */
  budgetActualCost: number | null;
  /** Certificado neto (SUBMITTED/APPROVED/PAID) convertido a `currency`. */
  certifiedNet: number;
  /** Saldo por cobrar estimado: certificado − cobrado (puede ser negativo). */
  receivable: number;
  /** Margen de caja: cobrado − pagado. */
  cashMargin: number;
  /** true si faltó alguna cotización al convertir. */
  fxIncomplete: boolean;
};

/** Resumen financiero de la obra desde tesorería + presupuesto + cronograma. */
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

  const [
    postedReceiptLines,
    pendingReceiptLines,
    postedPaymentLines,
    rejectionFees,
    budget,
    tasks,
    certifications,
  ] = await Promise.all([
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
        receipt: {
          select: {
            currency: true,
            issueDate: true,
            totalAmount: true,
            checks: {
              where: { status: "BOUNCED" },
              select: { amount: true },
            },
          },
        },
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
        paymentOrder: {
          select: {
            currency: true,
            issueDate: true,
            totalAmount: true,
            checksDelivered: {
              where: { status: "BOUNCED" },
              select: { amount: true },
            },
          },
        },
      },
    }),
    prisma.checkRejectionFee.findMany({
      where: {
        projectId,
        organizationId: session.organizationId,
        passedToDrawer: false,
      },
      select: {
        amount: true,
        currency: true,
        createdAt: true,
      },
    }),
    prisma.budget.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      include: {
        items: {
          select: { totalCost: true, actualCost: true, currency: true },
        },
      },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { progressPct: true },
    }),
    prisma.certification.findMany({
      where: {
        projectId,
        status: { in: ["SUBMITTED", "APPROVED", "PAID"] },
      },
      select: {
        netAmount: true,
        periodEnd: true,
        submittedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const chartCurrency = normalizeCurrency(
    budget?.currency ?? project.currency,
  );
  let fxIncomplete = false;

  let budgetEstimated: number | null = null;
  let budgetActualCost: number | null = null;

  if (budget) {
    budgetEstimated = 0;
    budgetActualCost = 0;
    const asOf = new Date();
    for (const item of budget.items) {
      const itemCurrency = normalizeCurrency(
        item.currency || chartCurrency,
      );
      const estimated = await tryConvertAmountOnDate(
        prisma,
        session.organizationId,
        toNumber(item.totalCost),
        itemCurrency,
        chartCurrency,
        asOf,
      );
      if (estimated == null) {
        fxIncomplete = true;
      } else {
        budgetEstimated += estimated;
      }

      const actual = await tryConvertAmountOnDate(
        prisma,
        session.organizationId,
        toNumber(item.actualCost),
        itemCurrency,
        chartCurrency,
        asOf,
      );
      if (actual == null) {
        fxIncomplete = true;
      } else {
        budgetActualCost += actual;
      }
    }
    budgetEstimated = Math.round(budgetEstimated * 100) / 100;
    budgetActualCost = Math.round(budgetActualCost * 100) / 100;
  }

  let clientPaidConverted = 0;
  for (const line of postedReceiptLines) {
    const receiptTotal = toNumber(line.receipt.totalAmount);
    const bouncedSum = line.receipt.checks.reduce(
      (acc, c) => acc + toNumber(c.amount),
      0,
    );
    const factor =
      receiptTotal > 0.009
        ? Math.max(0, (receiptTotal - bouncedSum) / receiptTotal)
        : 1;
    const effectiveAmount = toNumber(line.amount) * factor;

    const converted = await tryConvertAmountOnDate(
      prisma,
      session.organizationId,
      effectiveAmount,
      line.receipt.currency,
      chartCurrency,
      line.receipt.issueDate,
    );
    if (converted == null) {
      fxIncomplete = true;
    } else {
      clientPaidConverted += converted;
    }
  }
  clientPaidConverted = Math.round(clientPaidConverted * 100) / 100;

  let paidOutConverted = 0;
  for (const line of postedPaymentLines) {
    const orderTotal = toNumber(line.paymentOrder.totalAmount);
    const bouncedSum = line.paymentOrder.checksDelivered.reduce(
      (acc, c) => acc + toNumber(c.amount),
      0,
    );
    const factor =
      orderTotal > 0.009
        ? Math.max(0, (orderTotal - bouncedSum) / orderTotal)
        : 1;
    const converted = await tryConvertAmountOnDate(
      prisma,
      session.organizationId,
      toNumber(line.amount) * factor,
      line.paymentOrder.currency,
      chartCurrency,
      line.paymentOrder.issueDate,
    );
    if (converted == null) {
      fxIncomplete = true;
    } else {
      paidOutConverted += converted;
    }
  }
  for (const fee of rejectionFees) {
    const converted = await tryConvertAmountOnDate(
      prisma,
      session.organizationId,
      toNumber(fee.amount),
      fee.currency,
      chartCurrency,
      fee.createdAt,
    );
    if (converted == null) {
      fxIncomplete = true;
    } else {
      paidOutConverted += converted;
    }
  }
  paidOutConverted = Math.round(paidOutConverted * 100) / 100;

  const scheduleProgressPct =
    tasks.length === 0
      ? 0
      : Math.round(
          tasks.reduce((acc, t) => acc + toNumber(t.progressPct), 0) /
            tasks.length,
        );

  let certifiedNet = 0;
  for (const cert of certifications) {
    const asOf = cert.periodEnd ?? cert.submittedAt ?? cert.createdAt;
    const converted = await tryConvertAmountOnDate(
      prisma,
      session.organizationId,
      toNumber(cert.netAmount),
      chartCurrency,
      chartCurrency,
      asOf,
    );
    if (converted == null) {
      fxIncomplete = true;
      certifiedNet += toNumber(cert.netAmount);
    } else {
      certifiedNet += converted;
    }
  }
  certifiedNet = Math.round(certifiedNet * 100) / 100;

  const receivable = Math.round((certifiedNet - clientPaidConverted) * 100) / 100;
  const cashMargin =
    Math.round((clientPaidConverted - paidOutConverted) * 100) / 100;

  return {
    currency: chartCurrency,
    clientPaidByCurrency: sumByCurrency(
      postedReceiptLines.map((l) => {
        const receiptTotal = toNumber(l.receipt.totalAmount);
        const bouncedSum = l.receipt.checks.reduce(
          (acc, c) => acc + toNumber(c.amount),
          0,
        );
        const factor =
          receiptTotal > 0.009
            ? Math.max(0, (receiptTotal - bouncedSum) / receiptTotal)
            : 1;
        return {
          currency: l.receipt.currency,
          amount: toNumber(l.amount) * factor,
        };
      }),
    ),
    clientPendingByCurrency: sumByCurrency(
      pendingReceiptLines.map((l) => ({
        currency: l.receipt.currency,
        amount: toNumber(l.amount),
      })),
    ),
    paidOutByCurrency: sumByCurrency([
      ...postedPaymentLines.map((l) => {
        const orderTotal = toNumber(l.paymentOrder.totalAmount);
        const bouncedSum = l.paymentOrder.checksDelivered.reduce(
          (acc, c) => acc + toNumber(c.amount),
          0,
        );
        const factor =
          orderTotal > 0.009
            ? Math.max(0, (orderTotal - bouncedSum) / orderTotal)
            : 1;
        return {
          currency: l.paymentOrder.currency,
          amount: toNumber(l.amount) * factor,
        };
      }),
      ...rejectionFees.map((f) => ({
        currency: f.currency,
        amount: toNumber(f.amount),
      })),
    ]),
    clientPaidConverted,
    paidOutConverted,
    budgetEstimated,
    budgetCurrency: budget?.currency ?? project.currency,
    scheduleProgressPct,
    budgetActualCost,
    certifiedNet,
    receivable,
    cashMargin,
    fxIncomplete,
  };
}

/** Suma de un mapa de monedas (solo para UI cuando hay una sola moneda). */
export function totalOfCurrencyMap(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

/** Monto de un mapa en la moneda de referencia (0 si no hay). */
export function amountInCurrency(
  map: Record<string, number>,
  currency: string,
): number {
  const key = normalizeCurrency(currency);
  return map[key] ?? map[currency] ?? 0;
}
