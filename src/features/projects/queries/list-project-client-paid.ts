import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { PaymentMethod } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ProjectClientPaidDocument = {
  receiptId: string;
  number: string;
  issueDate: string;
  currency: string;
  /** Monto efectivo imputado a esta obra (tras cheques rechazados). */
  amount: number;
  /** Suma bruta de líneas a esta obra, sin descontar rechazos. */
  grossAmount: number;
  partyName: string | null;
  concept: string | null;
  paymentMethod: PaymentMethod;
  bouncedCheckAmount: number;
};

/** Recibos imputados que conforman el “Cobrado del cliente” de la obra. */
export async function listProjectClientPaidDocuments(
  projectId: string,
): Promise<ProjectClientPaidDocument[]> {
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

  const lines = await prisma.receiptLine.findMany({
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
          id: true,
          number: true,
          issueDate: true,
          currency: true,
          totalAmount: true,
          partyName: true,
          concept: true,
          paymentMethod: true,
          client: { select: { name: true } },
          checks: {
            where: { status: "BOUNCED" },
            select: { amount: true },
          },
        },
      },
    },
    orderBy: { receipt: { issueDate: "desc" } },
  });

  const byReceipt = new Map<
    string,
    {
      receiptId: string;
      number: string;
      issueDate: Date;
      currency: string;
      partyName: string | null;
      concept: string | null;
      paymentMethod: PaymentMethod;
      bouncedCheckAmount: number;
      factor: number;
      grossAmount: number;
    }
  >();

  for (const line of lines) {
    const r = line.receipt;
    let entry = byReceipt.get(r.id);
    if (!entry) {
      const receiptTotal = toNumber(r.totalAmount);
      const bouncedCheckAmount = r.checks.reduce(
        (acc, c) => acc + toNumber(c.amount),
        0,
      );
      const factor =
        receiptTotal > 0.009
          ? Math.max(0, (receiptTotal - bouncedCheckAmount) / receiptTotal)
          : 1;
      entry = {
        receiptId: r.id,
        number: r.number,
        issueDate: r.issueDate,
        currency: r.currency,
        partyName: r.client?.name ?? r.partyName,
        concept: r.concept,
        paymentMethod: r.paymentMethod,
        bouncedCheckAmount,
        factor,
        grossAmount: 0,
      };
      byReceipt.set(r.id, entry);
    }
    entry.grossAmount += toNumber(line.amount);
  }

  return [...byReceipt.values()]
    .map((e) => ({
      receiptId: e.receiptId,
      number: e.number,
      issueDate: e.issueDate.toISOString().slice(0, 10),
      currency: e.currency,
      amount: Math.round(e.grossAmount * e.factor * 100) / 100,
      grossAmount: Math.round(e.grossAmount * 100) / 100,
      partyName: e.partyName,
      concept: e.concept,
      paymentMethod: e.paymentMethod,
      bouncedCheckAmount: Math.round(e.bouncedCheckAmount * 100) / 100,
    }))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}
