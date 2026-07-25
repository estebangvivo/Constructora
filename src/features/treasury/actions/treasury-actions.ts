"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { PaymentMethod } from "@prisma/client";
import {
  applyBudgetImpact,
  nextTreasuryNumber,
  sumAmounts,
} from "@/features/treasury/lib/helpers";
import {
  postCashMovementFromTreasuryDoc,
  reverseCashMovementsForTreasuryDoc,
} from "@/features/treasury/lib/cash-from-treasury";
import { getOrganizationCurrency } from "@/features/settings/queries/get-organization";
import { toNumber } from "@/features/treasury/lib/cash-helpers";

export type TreasuryLineInput = {
  projectId?: string;
  budgetItemId?: string;
  description: string;
  amount: number;
};

export type CheckDetailsInput = {
  checkNumber?: string;
  checkBank?: string;
  checkIssueDate?: string;
  checkDueDate?: string;
  checkAccount?: string;
};

export type CreateReceiptInput = {
  issueDate: string;
  clientId?: string;
  partyName?: string;
  concept?: string;
  paymentMethod?: PaymentMethod;
  currency?: string;
  notes?: string;
  check?: CheckDetailsInput;
  lines: TreasuryLineInput[];
};

export type CreatePaymentOrderInput = {
  issueDate: string;
  supplierId?: string;
  partyName?: string;
  concept?: string;
  paymentMethod?: PaymentMethod;
  currency?: string;
  notes?: string;
  check?: CheckDetailsInput;
  lines: TreasuryLineInput[];
};

export type ActionResult =
  | { ok: true; id: string; number: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function normalizeCheck(
  paymentMethod: PaymentMethod | undefined,
  check?: CheckDetailsInput,
) {
  if (paymentMethod !== "CHECK") {
    return {
      checkNumber: null,
      checkBank: null,
      checkIssueDate: null,
      checkDueDate: null,
      checkAccount: null,
    };
  }

  const checkNumber = check?.checkNumber?.trim() || "";
  const checkBank = check?.checkBank?.trim() || "";
  if (!checkNumber || !checkBank) {
    throw new Error("Completá número y banco del cheque.");
  }

  return {
    checkNumber,
    checkBank,
    checkIssueDate: check?.checkIssueDate
      ? new Date(check.checkIssueDate)
      : null,
    checkDueDate: check?.checkDueDate ? new Date(check.checkDueDate) : null,
    checkAccount: check?.checkAccount?.trim() || null,
  };
}

function revalidateTreasury(projectIds: string[], doc?: { kind: "receipt" | "payment-order"; id: string }) {
  revalidatePath("/treasury");
  revalidatePath("/treasury/receipts");
  revalidatePath("/treasury/payment-orders");
  revalidatePath("/treasury/cash");
  revalidatePath("/treasury/cash/treasury");
  if (doc) {
    revalidatePath(
      doc.kind === "receipt"
        ? `/treasury/receipts/${doc.id}`
        : `/treasury/payment-orders/${doc.id}`,
    );
  }
  for (const projectId of [...new Set(projectIds.filter(Boolean))]) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/budget`);
  }
}

async function assertProjectsInOrg(
  organizationId: string,
  projectIds: string[],
) {
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (ids.length === 0) return;
  const count = await prisma.project.count({
    where: {
      id: { in: ids },
      organizationId,
      deletedAt: null,
    },
  });
  if (count !== ids.length) {
    throw new Error("Una o más obras no pertenecen a tu organización.");
  }
}

export async function createReceipt(
  input: CreateReceiptInput,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para emitir recibos." };
    }

    const lines = input.lines.filter(
      (l) => l.description.trim() && Number(l.amount) > 0,
    );
    if (lines.length === 0) {
      return { ok: false, error: "Agregá al menos una línea con monto." };
    }

    await assertProjectsInOrg(
      session.organizationId,
      lines.map((l) => l.projectId ?? ""),
    );

    const checkData = normalizeCheck(input.paymentMethod, input.check);
    const currency =
      input.currency?.trim() || (await getOrganizationCurrency());

    const receipt = await prisma.$transaction(async (tx) => {
      const number = await nextTreasuryNumber(
        session.organizationId,
        "REC",
        tx,
      );
      return tx.receipt.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.user.id,
          clientId: input.clientId || null,
          partyName: input.partyName?.trim() || null,
          number,
          issueDate: new Date(input.issueDate),
          status: "DRAFT",
          paymentMethod: input.paymentMethod ?? "TRANSFER",
          concept: input.concept?.trim() || null,
          currency,
          totalAmount: sumAmounts(lines),
          notes: input.notes?.trim() || null,
          ...checkData,
          lines: {
            create: lines.map((line, index) => ({
              projectId: line.projectId || null,
              budgetItemId: line.budgetItemId || null,
              description: line.description.trim(),
              amount: line.amount,
              sortOrder: index,
            })),
          },
        },
      });
    });

    revalidateTreasury(lines.map((l) => l.projectId ?? ""), {
      kind: "receipt",
      id: receipt.id,
    });
    return { ok: true, id: receipt.id, number: receipt.number };
  } catch (error) {
    console.error("createReceipt", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo crear el recibo.",
    };
  }
}

export async function createPaymentOrder(
  input: CreatePaymentOrderInput,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return {
        ok: false,
        error: "No tienes permiso para emitir órdenes de pago.",
      };
    }

    const lines = input.lines.filter(
      (l) => l.description.trim() && Number(l.amount) > 0,
    );
    if (lines.length === 0) {
      return { ok: false, error: "Agregá al menos una línea con monto." };
    }

    await assertProjectsInOrg(
      session.organizationId,
      lines.map((l) => l.projectId ?? ""),
    );

    const checkData = normalizeCheck(input.paymentMethod, input.check);
    const currency =
      input.currency?.trim() || (await getOrganizationCurrency());

    const order = await prisma.$transaction(async (tx) => {
      const number = await nextTreasuryNumber(session.organizationId, "OP", tx);
      return tx.paymentOrder.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.user.id,
          supplierId: input.supplierId || null,
          partyName: input.partyName?.trim() || null,
          number,
          issueDate: new Date(input.issueDate),
          status: "DRAFT",
          paymentMethod: input.paymentMethod ?? "TRANSFER",
          concept: input.concept?.trim() || null,
          currency,
          totalAmount: sumAmounts(lines),
          notes: input.notes?.trim() || null,
          ...checkData,
          lines: {
            create: lines.map((line, index) => ({
              projectId: line.projectId || null,
              budgetItemId: line.budgetItemId || null,
              description: line.description.trim(),
              amount: line.amount,
              sortOrder: index,
            })),
          },
        },
      });
    });

    revalidateTreasury(lines.map((l) => l.projectId ?? ""), {
      kind: "payment-order",
      id: order.id,
    });
    return { ok: true, id: order.id, number: order.number };
  } catch (error) {
    console.error("createPaymentOrder", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear la orden de pago.",
    };
  }
}

export async function issueReceipt(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const doc = await prisma.receipt.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { lines: true },
    });
    if (!doc) return { ok: false, error: "Recibo no encontrado." };
    if (doc.status !== "DRAFT") {
      return { ok: false, error: "Solo se pueden emitir borradores." };
    }

    await prisma.receipt.update({
      where: { id },
      data: { status: "ISSUED" },
    });

    revalidateTreasury(doc.lines.map((l) => l.projectId ?? ""), {
      kind: "receipt",
      id,
    });
    return { ok: true, id, number: doc.number };
  } catch (error) {
    console.error("issueReceipt", error);
    return { ok: false, error: "No se pudo emitir el recibo." };
  }
}

export async function postReceipt(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.receipt.findFirst({
        where: { id, organizationId: session.organizationId },
        include: { lines: true },
      });
      if (!doc) throw new Error("Recibo no encontrado.");
      if (doc.status !== "DRAFT" && doc.status !== "ISSUED") {
        throw new Error("El recibo no se puede imputar en este estado.");
      }

      await applyBudgetImpact(tx, doc.lines, "actualIncome", 1);

      if (doc.paymentMethod === "CASH") {
        await postCashMovementFromTreasuryDoc(tx, {
          organizationId: session.organizationId,
          currency: doc.currency,
          amount: toNumber(doc.totalAmount),
          kind: "INCOME",
          description: `Recibo ${doc.number}${doc.partyName ? ` · ${doc.partyName}` : ""}`,
          receiptId: doc.id,
          createdById: session.user.id,
        });
      }

      await tx.receipt.update({
        where: { id },
        data: { status: "POSTED", postedAt: new Date() },
      });

      return doc;
    });

    revalidateTreasury(result.lines.map((l) => l.projectId ?? ""), {
      kind: "receipt",
      id,
    });
    return { ok: true, id, number: result.number };
  } catch (error) {
    console.error("postReceipt", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo imputar el recibo.",
    };
  }
}

export async function cancelReceipt(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.receipt.findFirst({
        where: { id, organizationId: session.organizationId },
        include: { lines: true },
      });
      if (!doc) throw new Error("Recibo no encontrado.");
      if (doc.status === "CANCELLED") {
        throw new Error("El recibo ya está anulado.");
      }

      if (doc.status === "POSTED") {
        await applyBudgetImpact(tx, doc.lines, "actualIncome", -1);
        if (doc.paymentMethod === "CASH") {
          await reverseCashMovementsForTreasuryDoc(tx, {
            organizationId: session.organizationId,
            receiptId: doc.id,
            createdById: session.user.id,
          });
        }
      }

      await tx.receipt.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      return doc;
    });

    revalidateTreasury(result.lines.map((l) => l.projectId ?? ""), {
      kind: "receipt",
      id,
    });
    return { ok: true, id, number: result.number };
  } catch (error) {
    console.error("cancelReceipt", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo anular el recibo.",
    };
  }
}

export async function issuePaymentOrder(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const doc = await prisma.paymentOrder.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { lines: true },
    });
    if (!doc) return { ok: false, error: "Orden de pago no encontrada." };
    if (doc.status !== "DRAFT") {
      return { ok: false, error: "Solo se pueden emitir borradores." };
    }

    await prisma.paymentOrder.update({
      where: { id },
      data: { status: "ISSUED" },
    });

    revalidateTreasury(doc.lines.map((l) => l.projectId ?? ""), {
      kind: "payment-order",
      id,
    });
    return { ok: true, id, number: doc.number };
  } catch (error) {
    console.error("issuePaymentOrder", error);
    return { ok: false, error: "No se pudo emitir la orden de pago." };
  }
}

export async function postPaymentOrder(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.paymentOrder.findFirst({
        where: { id, organizationId: session.organizationId },
        include: { lines: true },
      });
      if (!doc) throw new Error("Orden de pago no encontrada.");
      if (doc.status !== "DRAFT" && doc.status !== "ISSUED") {
        throw new Error("La orden no se puede imputar en este estado.");
      }

      await applyBudgetImpact(tx, doc.lines, "actualCost", 1);

      if (doc.paymentMethod === "CASH") {
        await postCashMovementFromTreasuryDoc(tx, {
          organizationId: session.organizationId,
          currency: doc.currency,
          amount: toNumber(doc.totalAmount),
          kind: "EXPENSE",
          description: `OP ${doc.number}${doc.partyName ? ` · ${doc.partyName}` : ""}`,
          paymentOrderId: doc.id,
          createdById: session.user.id,
        });
      }

      await tx.paymentOrder.update({
        where: { id },
        data: { status: "POSTED", postedAt: new Date() },
      });

      return doc;
    });

    revalidateTreasury(result.lines.map((l) => l.projectId ?? ""), {
      kind: "payment-order",
      id,
    });
    return { ok: true, id, number: result.number };
  } catch (error) {
    console.error("postPaymentOrder", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo imputar la orden de pago.",
    };
  }
}

export async function cancelPaymentOrder(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.paymentOrder.findFirst({
        where: { id, organizationId: session.organizationId },
        include: { lines: true },
      });
      if (!doc) throw new Error("Orden de pago no encontrada.");
      if (doc.status === "CANCELLED") {
        throw new Error("La orden ya está anulada.");
      }

      if (doc.status === "POSTED") {
        await applyBudgetImpact(tx, doc.lines, "actualCost", -1);
        if (doc.paymentMethod === "CASH") {
          await reverseCashMovementsForTreasuryDoc(tx, {
            organizationId: session.organizationId,
            paymentOrderId: doc.id,
            createdById: session.user.id,
          });
        }
      }

      await tx.paymentOrder.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      return doc;
    });

    revalidateTreasury(result.lines.map((l) => l.projectId ?? ""), {
      kind: "payment-order",
      id,
    });
    return { ok: true, id, number: result.number };
  } catch (error) {
    console.error("cancelPaymentOrder", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo anular la orden de pago.",
    };
  }
}
