import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { CheckStatus } from "@prisma/client";
import { backfillMissingChecksFromPostedReceipts } from "@/features/treasury/lib/check-portfolio";

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
  receiptId: string | null;
  receiptNumber: string | null;
  paymentOrderId: string | null;
  paymentOrderNumber: string | null;
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
      receipt: { select: { id: true, number: true } },
      paymentOrder: { select: { id: true, number: true } },
    },
  });

  return rows.map((c) => ({
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
    receiptId: c.receiptId,
    receiptNumber: c.receipt?.number ?? null,
    paymentOrderId: c.paymentOrderId,
    paymentOrderNumber: c.paymentOrder?.number ?? null,
    createdAt: c.createdAt,
  }));
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
