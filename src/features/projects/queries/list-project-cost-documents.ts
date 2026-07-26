import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { PaymentMethod } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ProjectCostDocument =
  | {
      kind: "PAYMENT_ORDER";
      id: string;
      number: string;
      issueDate: string;
      currency: string;
      amount: number;
      partyName: string | null;
      concept: string | null;
      paymentMethod: PaymentMethod;
    }
  | {
      kind: "REJECTION_FEE";
      id: string;
      number: string;
      issueDate: string;
      currency: string;
      amount: number;
      description: string;
      checkNumber: string;
      checkBank: string;
      receiptId: string | null;
      receiptNumber: string | null;
      budgetItemLabel: string | null;
    };

/** Documentos que conforman el costo real / pagado de la obra. */
export async function listProjectCostDocuments(
  projectId: string,
): Promise<ProjectCostDocument[]> {
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

  const [paymentLines, rejectionFees] = await Promise.all([
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
            id: true,
            number: true,
            issueDate: true,
            currency: true,
            partyName: true,
            concept: true,
            paymentMethod: true,
            supplier: { select: { name: true } },
          },
        },
      },
    }),
    prisma.checkRejectionFee.findMany({
      where: {
        projectId,
        organizationId: session.organizationId,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        currency: true,
        createdAt: true,
        budgetItem: { select: { code: true, description: true } },
        checkInstrument: {
          select: {
            number: true,
            bank: true,
            receipt: { select: { id: true, number: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byPayment = new Map<
    string,
    {
      id: string;
      number: string;
      issueDate: Date;
      currency: string;
      amount: number;
      partyName: string | null;
      concept: string | null;
      paymentMethod: PaymentMethod;
    }
  >();

  for (const line of paymentLines) {
    const po = line.paymentOrder;
    const existing = byPayment.get(po.id);
    if (existing) {
      existing.amount += toNumber(line.amount);
      continue;
    }
    byPayment.set(po.id, {
      id: po.id,
      number: po.number,
      issueDate: po.issueDate,
      currency: po.currency,
      amount: toNumber(line.amount),
      partyName: po.supplier?.name ?? po.partyName,
      concept: po.concept,
      paymentMethod: po.paymentMethod,
    });
  }

  const documents: ProjectCostDocument[] = [
    ...[...byPayment.values()].map(
      (po): ProjectCostDocument => ({
        kind: "PAYMENT_ORDER",
        id: po.id,
        number: po.number,
        issueDate: po.issueDate.toISOString().slice(0, 10),
        currency: po.currency,
        amount: Math.round(po.amount * 100) / 100,
        partyName: po.partyName,
        concept: po.concept,
        paymentMethod: po.paymentMethod,
      }),
    ),
    ...rejectionFees.map(
      (fee): ProjectCostDocument => ({
        kind: "REJECTION_FEE",
        id: fee.id,
        number: `Rechazo · ${fee.checkInstrument.number}`,
        issueDate: fee.createdAt.toISOString().slice(0, 10),
        currency: fee.currency,
        amount: Math.round(toNumber(fee.amount) * 100) / 100,
        description: fee.description,
        checkNumber: fee.checkInstrument.number,
        checkBank: fee.checkInstrument.bank,
        receiptId: fee.checkInstrument.receipt?.id ?? null,
        receiptNumber: fee.checkInstrument.receipt?.number ?? null,
        budgetItemLabel: fee.budgetItem
          ? `${fee.budgetItem.code} · ${fee.budgetItem.description}`
          : null,
      }),
    ),
  ];

  return documents.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}
