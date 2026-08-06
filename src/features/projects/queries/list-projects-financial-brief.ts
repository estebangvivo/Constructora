import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { normalizeCurrency } from "@/config/currencies";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ProjectListFinancialBrief = {
  currency: string;
  cobrado: number;
  pagado: number;
  cashMargin: number;
};

/**
 * Margen de caja rápido por obra (cobrado − pagado POSTED), sin FX compleja.
 * Usa la moneda de la obra; montos en otras monedas se suman crudos (MVP listado).
 */
export async function listProjectsFinancialBrief(
  projectIds: string[],
): Promise<Record<string, ProjectListFinancialBrief>> {
  if (projectIds.length === 0) return {};
  const session = await requireSession();

  const projects = await prisma.project.findMany({
    where: {
      id: { in: projectIds },
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: { id: true, currency: true },
  });
  const currencyById = new Map(
    projects.map((p) => [p.id, normalizeCurrency(p.currency)]),
  );

  const [receiptLines, paymentLines] = await Promise.all([
    prisma.receiptLine.findMany({
      where: {
        projectId: { in: projectIds },
        receipt: {
          organizationId: session.organizationId,
          status: "POSTED",
        },
      },
      select: {
        projectId: true,
        amount: true,
        receipt: {
          select: {
            currency: true,
            totalAmount: true,
            checks: {
              where: { status: "BOUNCED" },
              select: { amount: true },
            },
          },
        },
      },
    }),
    prisma.paymentOrderLine.findMany({
      where: {
        projectId: { in: projectIds },
        paymentOrder: {
          organizationId: session.organizationId,
          status: "POSTED",
        },
      },
      select: {
        projectId: true,
        amount: true,
        paymentOrder: {
          select: {
            currency: true,
            totalAmount: true,
            checksDelivered: {
              where: { status: "BOUNCED" },
              select: { amount: true },
            },
          },
        },
      },
    }),
  ]);

  const cobrado = new Map<string, number>();
  const pagado = new Map<string, number>();

  for (const line of receiptLines) {
    if (!line.projectId) continue;
    const total = toNumber(line.receipt.totalAmount);
    const bounced = line.receipt.checks.reduce(
      (a, c) => a + toNumber(c.amount),
      0,
    );
    const factor = total > 0.009 ? Math.max(0, (total - bounced) / total) : 1;
    cobrado.set(
      line.projectId,
      (cobrado.get(line.projectId) ?? 0) + toNumber(line.amount) * factor,
    );
  }

  for (const line of paymentLines) {
    if (!line.projectId) continue;
    const total = toNumber(line.paymentOrder.totalAmount);
    const bounced = line.paymentOrder.checksDelivered.reduce(
      (a, c) => a + toNumber(c.amount),
      0,
    );
    const factor = total > 0.009 ? Math.max(0, (total - bounced) / total) : 1;
    pagado.set(
      line.projectId,
      (pagado.get(line.projectId) ?? 0) + toNumber(line.amount) * factor,
    );
  }

  const out: Record<string, ProjectListFinancialBrief> = {};
  for (const id of projectIds) {
    const c = Math.round((cobrado.get(id) ?? 0) * 100) / 100;
    const p = Math.round((pagado.get(id) ?? 0) * 100) / 100;
    out[id] = {
      currency: currencyById.get(id) ?? "ARS",
      cobrado: c,
      pagado: p,
      cashMargin: Math.round((c - p) * 100) / 100,
    };
  }
  return out;
}
