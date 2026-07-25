import { Prisma, type PaymentMethod } from "@prisma/client";

type Tx = Prisma.TransactionClient;

function toNumber(value: { toNumber(): number } | number | Prisma.Decimal): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value);
}

/** Al imputar un recibo, ingresa a cartera los cheques de sus pagos. */
export async function ingestChecksFromPostedReceipt(
  tx: Tx,
  input: {
    organizationId: string;
    receiptId: string;
    currency: string;
    drawerName: string | null;
    payments: {
      method: PaymentMethod;
      amount: Prisma.Decimal | number;
      checkNumber: string | null;
      checkBank: string | null;
      checkIssueDate: Date | null;
      checkDueDate: Date | null;
      checkAccount: string | null;
    }[];
  },
) {
  for (const payment of input.payments) {
    if (payment.method !== "CHECK") continue;
    const number = payment.checkNumber?.trim();
    const bank = payment.checkBank?.trim();
    if (!number || !bank) {
      throw new Error("Cheque sin número o banco en el recibo.");
    }

    const existing = await tx.checkInstrument.findUnique({
      where: {
        organizationId_bank_number: {
          organizationId: input.organizationId,
          bank,
          number,
        },
      },
    });
    if (existing && existing.status !== "CANCELLED") {
      throw new Error(
        `El cheque ${number} del banco ${bank} ya está en cartera o fue entregado.`,
      );
    }

    if (existing?.status === "CANCELLED") {
      await tx.checkInstrument.update({
        where: { id: existing.id },
        data: {
          amount: payment.amount,
          currency: input.currency,
          issueDate: payment.checkIssueDate,
          dueDate: payment.checkDueDate,
          account: payment.checkAccount,
          drawerName: input.drawerName,
          status: "IN_PORTFOLIO",
          receiptId: input.receiptId,
          paymentOrderId: null,
        },
      });
      continue;
    }

    await tx.checkInstrument.create({
      data: {
        organizationId: input.organizationId,
        number,
        bank,
        amount: payment.amount,
        currency: input.currency,
        issueDate: payment.checkIssueDate,
        dueDate: payment.checkDueDate,
        account: payment.checkAccount,
        drawerName: input.drawerName,
        status: "IN_PORTFOLIO",
        receiptId: input.receiptId,
      },
    });
  }
}

/** Al anular un recibo imputado, cancela cheques que sigan en cartera. */
export async function cancelChecksFromReceipt(
  tx: Tx,
  organizationId: string,
  receiptId: string,
) {
  const checks = await tx.checkInstrument.findMany({
    where: { organizationId, receiptId },
  });
  for (const check of checks) {
    if (check.status === "DELIVERED") {
      throw new Error(
        `No se puede anular: el cheque ${check.number} (${check.bank}) ya fue entregado en una orden de pago.`,
      );
    }
    await tx.checkInstrument.update({
      where: { id: check.id },
      data: { status: "CANCELLED" },
    });
  }
}

/**
 * Al imputar una OP, marca como entregados los cheques vinculados.
 * Valida que estén en cartera y que el monto coincida.
 */
export async function deliverChecksFromPostedPaymentOrder(
  tx: Tx,
  input: {
    organizationId: string;
    paymentOrderId: string;
    payments: {
      method: PaymentMethod;
      amount: Prisma.Decimal | number;
      checkInstrumentId: string | null;
    }[];
  },
) {
  for (const payment of input.payments) {
    if (payment.method !== "CHECK") continue;
    if (!payment.checkInstrumentId) {
      throw new Error(
        "En órdenes de pago, los cheques deben elegirse de la cartera.",
      );
    }

    const check = await tx.checkInstrument.findFirst({
      where: {
        id: payment.checkInstrumentId,
        organizationId: input.organizationId,
      },
    });
    if (!check) throw new Error("Cheque de cartera no encontrado.");
    if (check.status !== "IN_PORTFOLIO") {
      throw new Error(
        `El cheque ${check.number} (${check.bank}) no está disponible en cartera.`,
      );
    }

    const payAmount = toNumber(payment.amount);
    const checkAmount = toNumber(check.amount);
    if (Math.abs(payAmount - checkAmount) > 0.009) {
      throw new Error(
        `El monto del pago con cheque ${check.number} debe ser ${checkAmount.toFixed(2)}.`,
      );
    }

    await tx.checkInstrument.update({
      where: { id: check.id },
      data: {
        status: "DELIVERED",
        paymentOrderId: input.paymentOrderId,
      },
    });
  }
}

/** Al anular una OP, devuelve los cheques a cartera. */
export async function returnChecksFromPaymentOrder(
  tx: Tx,
  organizationId: string,
  paymentOrderId: string,
) {
  await tx.checkInstrument.updateMany({
    where: {
      organizationId,
      paymentOrderId,
      status: "DELIVERED",
    },
    data: {
      status: "IN_PORTFOLIO",
      paymentOrderId: null,
    },
  });
}

/**
 * Repara cheques faltantes de recibos ya imputados
 * (p. ej. documentos posteados antes de existir la cartera).
 */
export async function backfillMissingChecksFromPostedReceipts(
  tx: Tx,
  organizationId: string,
): Promise<number> {
  const receipts = await tx.receipt.findMany({
    where: { organizationId, status: "POSTED" },
    include: {
      payments: true,
      checks: { select: { id: true } },
      client: { select: { name: true } },
    },
  });

  let created = 0;
  for (const receipt of receipts) {
    const payments =
      receipt.payments.length > 0
        ? receipt.payments
        : receipt.paymentMethod === "CHECK"
          ? [
              {
                method: "CHECK" as const,
                amount: receipt.totalAmount,
                checkNumber: receipt.checkNumber,
                checkBank: receipt.checkBank,
                checkIssueDate: receipt.checkIssueDate,
                checkDueDate: receipt.checkDueDate,
                checkAccount: receipt.checkAccount,
              },
            ]
          : [];

    const checkPayments = payments.filter((p) => p.method === "CHECK");
    if (checkPayments.length === 0) continue;
    if (receipt.checks.length >= checkPayments.length) continue;

    const before = await tx.checkInstrument.count({
      where: { organizationId, receiptId: receipt.id },
    });

    try {
      await ingestChecksFromPostedReceipt(tx, {
        organizationId,
        receiptId: receipt.id,
        currency: receipt.currency,
        drawerName: receipt.client?.name ?? receipt.partyName,
        payments: checkPayments,
      });
    } catch (error) {
      // Si ya existe por banco+número, no abortar el resto.
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("ya está en cartera")) throw error;
    }

    const after = await tx.checkInstrument.count({
      where: { organizationId, receiptId: receipt.id },
    });
    created += Math.max(0, after - before);
  }

  return created;
}
