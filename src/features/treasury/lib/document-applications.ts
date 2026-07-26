import type { Prisma } from "@prisma/client";
import { round2 } from "@/features/treasury/lib/cash-labels";

type Tx = Prisma.TransactionClient;

function toNumber(value: { toNumber(): number } | number | Prisma.Decimal): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value);
}

export type DocumentApplicationInput = {
  documentId: string;
  amount: number;
};

/** Valida aplicaciones: montos > 0, suma ≤ total, docs con saldo. */
export function validateApplicationsSum(
  apps: DocumentApplicationInput[],
  docTotal: number,
  label: string,
): string | null {
  const cleaned = apps.filter((a) => a.amount > 0.009);
  if (cleaned.length === 0) return null;
  const sum = cleaned.reduce((acc, a) => acc + a.amount, 0);
  if (sum > docTotal + 0.009) {
    return `La suma aplicada a ${label} (${sum.toFixed(2)}) supera el total del documento (${docTotal.toFixed(2)}).`;
  }
  return null;
}

/** Persiste aplicaciones de recibo → certificaciones (reemplaza las existentes). */
export async function replaceReceiptCertificationApps(
  tx: Tx,
  receiptId: string,
  apps: DocumentApplicationInput[],
) {
  await tx.receiptCertificationApplication.deleteMany({
    where: { receiptId },
  });
  const rows = apps.filter((a) => a.amount > 0.009);
  if (rows.length === 0) return;
  await tx.receiptCertificationApplication.createMany({
    data: rows.map((a) => ({
      receiptId,
      certificationId: a.documentId,
      amount: round2(a.amount),
    })),
  });
}

/** Persiste aplicaciones de OP → facturas. */
export async function replacePaymentOrderInvoiceApps(
  tx: Tx,
  paymentOrderId: string,
  apps: DocumentApplicationInput[],
) {
  await tx.paymentOrderInvoiceApplication.deleteMany({
    where: { paymentOrderId },
  });
  const rows = apps.filter((a) => a.amount > 0.009);
  if (rows.length === 0) return;
  await tx.paymentOrderInvoiceApplication.createMany({
    data: rows.map((a) => ({
      paymentOrderId,
      purchaseInvoiceId: a.documentId,
      amount: round2(a.amount),
    })),
  });
}

/**
 * Al imputar recibo: suma collectedAmount y marca PAID si corresponde.
 * direction 1 = post, -1 = cancel.
 */
export async function applyReceiptCertificationBalances(
  tx: Tx,
  organizationId: string,
  receiptId: string,
  direction: 1 | -1,
) {
  const apps = await tx.receiptCertificationApplication.findMany({
    where: { receiptId },
  });
  if (apps.length === 0) return;

  for (const app of apps) {
    const cert = await tx.certification.findFirst({
      where: {
        id: app.certificationId,
        project: { organizationId },
      },
    });
    if (!cert) {
      throw new Error("Certificación aplicada no encontrada.");
    }

    const delta = direction * toNumber(app.amount);
    const nextCollected = round2(
      Math.max(0, toNumber(cert.collectedAmount) + delta),
    );
    const net = toNumber(cert.netAmount);
    const fullyPaid = nextCollected >= net - 0.009;

    if (direction === 1 && nextCollected > net + 0.009) {
      throw new Error(
        `El cobro supera el saldo de la certificación ${cert.number}.`,
      );
    }

    await tx.certification.update({
      where: { id: cert.id },
      data: {
        collectedAmount: nextCollected,
        status: fullyPaid
          ? "PAID"
          : cert.status === "PAID" && !fullyPaid
            ? "APPROVED"
            : undefined,
        paidAt: fullyPaid
          ? cert.paidAt ?? new Date()
          : direction === -1 && !fullyPaid
            ? null
            : undefined,
      },
    });
  }
}

/**
 * Al imputar OP: suma paidAmount de facturas.
 * direction 1 = post, -1 = cancel.
 */
export async function applyPaymentOrderInvoiceBalances(
  tx: Tx,
  organizationId: string,
  paymentOrderId: string,
  direction: 1 | -1,
) {
  const apps = await tx.paymentOrderInvoiceApplication.findMany({
    where: { paymentOrderId },
  });
  if (apps.length === 0) return;

  for (const app of apps) {
    const inv = await tx.purchaseInvoice.findFirst({
      where: {
        id: app.purchaseInvoiceId,
        project: { organizationId },
      },
    });
    if (!inv) {
      throw new Error("Factura aplicada no encontrada.");
    }
    if (direction === 1 && inv.status !== "CONFIRMED") {
      throw new Error(
        `La factura ${inv.number} debe estar confirmada para pagarla.`,
      );
    }

    const delta = direction * toNumber(app.amount);
    const nextPaid = round2(Math.max(0, toNumber(inv.paidAmount) + delta));
    const total = toNumber(inv.totalAmount);

    if (direction === 1 && nextPaid > total + 0.009) {
      throw new Error(
        `El pago supera el saldo de la factura ${inv.number}.`,
      );
    }

    await tx.purchaseInvoice.update({
      where: { id: inv.id },
      data: { paidAmount: nextPaid },
    });
  }
}
