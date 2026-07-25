import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { normalizeCurrency } from "@/config/currencies";
import { convertAmountOnDate } from "@/lib/exchange/convert-on-date";

type Tx = Prisma.TransactionClient;

function toNumber(value: { toNumber(): number } | number | Prisma.Decimal): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value);
}

/** Siguiente número REC-YYYY-NNNN / OP-YYYY-NNNN por organización. */
export async function nextTreasuryNumber(
  organizationId: string,
  prefix: "REC" | "OP",
  tx: Tx = prisma,
): Promise<string> {
  const year = new Date().getFullYear();
  const head = `${prefix}-${year}-`;

  if (prefix === "REC") {
    const last = await tx.receipt.findFirst({
      where: {
        organizationId,
        number: { startsWith: head },
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const seq = last ? Number(last.number.slice(head.length)) + 1 : 1;
    return `${head}${String(seq).padStart(4, "0")}`;
  }

  const last = await tx.paymentOrder.findFirst({
    where: {
      organizationId,
      number: { startsWith: head },
    },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(head.length)) + 1 : 1;
  return `${head}${String(seq).padStart(4, "0")}`;
}

/**
 * Recalcula actualIncome / actualCost de partidas desde documentos POSTED,
 * convirtiendo cada línea a la moneda de la partida con el TC de la fecha
 * del recibo / orden de pago.
 */
export async function syncBudgetItemsFromTreasury(
  tx: Tx,
  organizationId: string,
  budgetItemIds: (string | null | undefined)[],
) {
  const ids = [
    ...new Set(
      budgetItemIds.filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return;

  for (const budgetItemId of ids) {
    const item = await tx.budgetItem.findUnique({
      where: { id: budgetItemId },
      select: { id: true, currency: true },
    });
    if (!item) continue;

    const itemCurrency = normalizeCurrency(item.currency);

    const [receiptLines, paymentLines] = await Promise.all([
      tx.receiptLine.findMany({
        where: {
          budgetItemId,
          receipt: { organizationId, status: "POSTED" },
        },
        select: {
          amount: true,
          receipt: { select: { currency: true, issueDate: true } },
        },
      }),
      tx.paymentOrderLine.findMany({
        where: {
          budgetItemId,
          paymentOrder: { organizationId, status: "POSTED" },
        },
        select: {
          amount: true,
          paymentOrder: {
            select: { currency: true, issueDate: true },
          },
        },
      }),
    ]);

    let actualIncome = 0;
    for (const line of receiptLines) {
      actualIncome += await convertAmountOnDate(
        tx,
        organizationId,
        toNumber(line.amount),
        line.receipt.currency,
        itemCurrency,
        line.receipt.issueDate,
      );
    }

    let actualCost = 0;
    for (const line of paymentLines) {
      actualCost += await convertAmountOnDate(
        tx,
        organizationId,
        toNumber(line.amount),
        line.paymentOrder.currency,
        itemCurrency,
        line.paymentOrder.issueDate,
      );
    }

    await tx.budgetItem.update({
      where: { id: budgetItemId },
      data: {
        actualIncome: new Prisma.Decimal(actualIncome.toFixed(2)),
        actualCost: new Prisma.Decimal(actualCost.toFixed(2)),
      },
    });
  }
}

/**
 * @deprecated Preferí syncBudgetItemsFromTreasury tras cambiar el estado del doc.
 * Se mantiene por compatibilidad; convierte e incrementa (no ideal para anulación histórica).
 */
export async function applyBudgetImpact(
  tx: Tx,
  lines: { budgetItemId: string | null; amount: Prisma.Decimal | number }[],
  field: "actualIncome" | "actualCost",
  direction: 1 | -1,
) {
  for (const line of lines) {
    if (!line.budgetItemId) continue;
    const amount =
      typeof line.amount === "number"
        ? line.amount
        : Number(line.amount.toString());
    if (!amount) continue;

    await tx.budgetItem.update({
      where: { id: line.budgetItemId },
      data: {
        [field]: {
          increment: direction * amount,
        },
      },
    });
  }
}

export function sumAmounts(
  lines: { amount: number }[],
): Prisma.Decimal {
  const total = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  return new Prisma.Decimal(total.toFixed(2));
}
