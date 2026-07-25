import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

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

/** Aplica o revierte impacto en partidas (actualIncome / actualCost). */
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
