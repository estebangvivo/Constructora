import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type AgingBucket = "b0_30" | "b31_60" | "b61_90" | "b90_plus";

export type AgingSummary = Record<AgingBucket, number>;

export type AccountStatementMovement = {
  id: string;
  date: string;
  kind: "CERTIFICATION" | "RECEIPT" | "INVOICE" | "PAYMENT_ORDER";
  number: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  href: string;
  projectName?: string | null;
};

export type AccountStatement = {
  partyId: string;
  partyName: string;
  partyKind: "client" | "supplier";
  currency: string;
  balance: number;
  aging: AgingSummary;
  movements: AccountStatementMovement[];
};

export type AccountPartySummary = {
  id: string;
  name: string;
  balance: number;
  currency: string;
  aging: AgingSummary;
};

function emptyAging(): AgingSummary {
  return { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
}

/** Días desde la fecha del documento hasta hoy (negativo = a futuro). */
function agingBucket(asOf: Date, docDate: Date): AgingBucket {
  const days = Math.floor(
    (asOf.getTime() - docDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 30) return "b0_30";
  if (days <= 60) return "b31_60";
  if (days <= 90) return "b61_90";
  return "b90_plus";
}

/** @db.Date llega como medianoche UTC. */
function parseDbDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type AgingItem = { amount: number; date: Date };

/**
 * Aplica créditos FIFO sobre débitos y reparte el saldo abierto
 * (positivo o a favor) en buckets por fecha del documento.
 */
function buildAging(
  debits: AgingItem[],
  credits: AgingItem[],
  asOf: Date,
): AgingSummary {
  const openDebits = debits
    .map((d) => ({ ...d }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const openCredits = credits
    .map((c) => ({ ...c }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let di = 0;
  let ci = 0;
  while (di < openDebits.length && ci < openCredits.length) {
    const apply = Math.min(openDebits[di].amount, openCredits[ci].amount);
    openDebits[di].amount = round2(openDebits[di].amount - apply);
    openCredits[ci].amount = round2(openCredits[ci].amount - apply);
    if (openDebits[di].amount <= 0.009) di += 1;
    if (openCredits[ci].amount <= 0.009) ci += 1;
  }

  const aging = emptyAging();
  for (const d of openDebits) {
    if (d.amount <= 0.009) continue;
    aging[agingBucket(asOf, d.date)] += d.amount;
  }
  for (const c of openCredits) {
    if (c.amount <= 0.009) continue;
    // Saldo a favor: resta en el bucket de la fecha del cobro/pago
    aging[agingBucket(asOf, c.date)] -= c.amount;
  }
  for (const key of Object.keys(aging) as AgingBucket[]) {
    aging[key] = round2(aging[key]);
  }
  return aging;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Listado de clientes con saldo abierto (certificaciones − recibos). */
export async function listClientAccountSummaries(): Promise<
  AccountPartySummary[]
> {
  const session = await requireSession();
  const clients = await prisma.client.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const rows: AccountPartySummary[] = [];
  for (const client of clients) {
    const stmt = await getClientAccountStatement(client.id);
    if (!stmt || Math.abs(stmt.balance) < 0.009) continue;
    rows.push({
      id: client.id,
      name: client.name,
      balance: stmt.balance,
      currency: stmt.currency,
      aging: stmt.aging,
    });
  }
  return rows;
}

/** Listado de proveedores con saldo abierto (facturas − OP). */
export async function listSupplierAccountSummaries(): Promise<
  AccountPartySummary[]
> {
  const session = await requireSession();
  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const rows: AccountPartySummary[] = [];
  for (const supplier of suppliers) {
    const stmt = await getSupplierAccountStatement(supplier.id);
    if (!stmt || Math.abs(stmt.balance) < 0.009) continue;
    rows.push({
      id: supplier.id,
      name: supplier.name,
      balance: stmt.balance,
      currency: stmt.currency,
      aging: stmt.aging,
    });
  }
  return rows;
}

export type PartyBalance = {
  balance: number;
  currency: string;
};

/** Saldos de CT por cliente (certificaciones − recibos), sin aging ni movimientos. */
export async function mapClientBalances(): Promise<Map<string, PartyBalance>> {
  const session = await requireSession();
  const map = new Map<string, PartyBalance>();

  const [certs, receipts] = await Promise.all([
    prisma.certification.findMany({
      where: {
        status: { in: ["APPROVED", "PAID"] },
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
          clientId: { not: null },
        },
      },
      select: {
        netAmount: true,
        project: { select: { clientId: true, currency: true } },
      },
    }),
    prisma.receipt.findMany({
      where: {
        organizationId: session.organizationId,
        status: "POSTED",
        clientId: { not: null },
      },
      select: { clientId: true, totalAmount: true, currency: true },
    }),
  ]);

  for (const c of certs) {
    const clientId = c.project.clientId;
    if (!clientId) continue;
    const prev = map.get(clientId) ?? {
      balance: 0,
      currency: c.project.currency || "ARS",
    };
    prev.balance = round2(prev.balance + toNumber(c.netAmount));
    prev.currency = c.project.currency || prev.currency;
    map.set(clientId, prev);
  }
  for (const r of receipts) {
    if (!r.clientId) continue;
    const prev = map.get(r.clientId) ?? {
      balance: 0,
      currency: r.currency || "ARS",
    };
    prev.balance = round2(prev.balance - toNumber(r.totalAmount));
    prev.currency = r.currency || prev.currency;
    map.set(r.clientId, prev);
  }

  return map;
}

/** Saldos de CT por proveedor (facturas − OP), sin aging ni movimientos. */
export async function mapSupplierBalances(): Promise<Map<string, PartyBalance>> {
  const session = await requireSession();
  const map = new Map<string, PartyBalance>();

  const [invoices, orders] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        status: "CONFIRMED",
        supplierId: { not: null },
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
      select: {
        supplierId: true,
        totalAmount: true,
        currency: true,
      },
    }),
    prisma.paymentOrder.findMany({
      where: {
        organizationId: session.organizationId,
        status: "POSTED",
        supplierId: { not: null },
      },
      select: { supplierId: true, totalAmount: true, currency: true },
    }),
  ]);

  for (const inv of invoices) {
    if (!inv.supplierId) continue;
    const prev = map.get(inv.supplierId) ?? {
      balance: 0,
      currency: inv.currency || "ARS",
    };
    prev.balance = round2(prev.balance + toNumber(inv.totalAmount));
    prev.currency = inv.currency || prev.currency;
    map.set(inv.supplierId, prev);
  }
  for (const op of orders) {
    if (!op.supplierId) continue;
    const prev = map.get(op.supplierId) ?? {
      balance: 0,
      currency: op.currency || "ARS",
    };
    prev.balance = round2(prev.balance - toNumber(op.totalAmount));
    prev.currency = op.currency || prev.currency;
    map.set(op.supplierId, prev);
  }

  return map;
}

export async function getClientAccountStatement(
  clientId: string,
): Promise<AccountStatement | null> {
  const session = await requireSession();
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session.organizationId },
    select: { id: true, name: true },
  });
  if (!client) return null;

  const [certs, receipts] = await Promise.all([
    prisma.certification.findMany({
      where: {
        status: { in: ["APPROVED", "PAID"] },
        project: {
          organizationId: session.organizationId,
          clientId,
          deletedAt: null,
        },
      },
      include: {
        project: { select: { id: true, name: true, code: true, currency: true } },
      },
      orderBy: { periodEnd: "asc" },
    }),
    prisma.receipt.findMany({
      where: {
        organizationId: session.organizationId,
        clientId,
        status: "POSTED",
      },
      orderBy: { issueDate: "asc" },
    }),
  ]);

  const movements: AccountStatementMovement[] = [];
  const asOf = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );
  let currency = "ARS";
  const agingDebits: AgingItem[] = [];
  const agingCredits: AgingItem[] = [];

  for (const c of certs) {
    const net = toNumber(c.netAmount);
    currency = c.project.currency || currency;
    const due = parseDbDate(c.approvedAt ?? c.periodEnd);
    movements.push({
      id: `cert-${c.id}`,
      date: isoDay(c.periodEnd),
      kind: "CERTIFICATION",
      number: c.number,
      description: `Certificación · ${c.project.code} ${c.project.name}`,
      debit: net,
      credit: 0,
      currency: c.project.currency || "ARS",
      href: `/projects/${c.project.id}/certifications/${c.id}`,
      projectName: `${c.project.code} · ${c.project.name}`,
    });
    if (net > 0.009) {
      agingDebits.push({ amount: net, date: due });
    }
  }

  for (const r of receipts) {
    const amount = toNumber(r.totalAmount);
    currency = r.currency || currency;
    const issued = parseDbDate(r.issueDate);
    movements.push({
      id: `rec-${r.id}`,
      date: isoDay(r.issueDate),
      kind: "RECEIPT",
      number: r.number,
      description: r.concept || "Recibo de cobro",
      debit: 0,
      credit: amount,
      currency: r.currency,
      href: `/treasury/receipts/${r.id}`,
    });
    if (amount > 0.009) {
      agingCredits.push({ amount, date: issued });
    }
  }

  const balance = round2(
    movements.reduce((acc, m) => acc + m.debit - m.credit, 0),
  );
  const aging = buildAging(agingDebits, agingCredits, asOf);

  movements.sort((a, b) => a.date.localeCompare(b.date));

  return {
    partyId: client.id,
    partyName: client.name,
    partyKind: "client",
    currency,
    balance,
    aging,
    movements,
  };
}

/**
 * Cuenta corriente del cliente limitada a una obra:
 * Debe = certificaciones de la obra; Haber = recibos imputados a esa obra.
 */
export async function getProjectClientAccountStatement(
  projectId: string,
): Promise<AccountStatement | null> {
  const session = await requireSession();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      currency: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  });
  if (!project?.clientId || !project.client) return null;

  const [certs, receiptLines] = await Promise.all([
    prisma.certification.findMany({
      where: {
        projectId: project.id,
        status: { in: ["APPROVED", "PAID"] },
      },
      orderBy: { periodEnd: "asc" },
      select: {
        id: true,
        number: true,
        netAmount: true,
        periodEnd: true,
        approvedAt: true,
      },
    }),
    prisma.receiptLine.findMany({
      where: {
        projectId: project.id,
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
            concept: true,
            checks: {
              where: { status: "BOUNCED" },
              select: { amount: true },
            },
          },
        },
      },
      orderBy: { receipt: { issueDate: "asc" } },
    }),
  ]);

  const movements: AccountStatementMovement[] = [];
  const asOf = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );
  let currency = project.currency || "ARS";
  const agingDebits: AgingItem[] = [];
  const agingCredits: AgingItem[] = [];

  for (const c of certs) {
    const net = toNumber(c.netAmount);
    const due = parseDbDate(c.approvedAt ?? c.periodEnd);
    movements.push({
      id: `cert-${c.id}`,
      date: isoDay(c.periodEnd),
      kind: "CERTIFICATION",
      number: c.number,
      description: "Certificación de avance",
      debit: net,
      credit: 0,
      currency,
      href: `/projects/${project.id}/certifications/${c.id}`,
      projectName: `${project.code} · ${project.name}`,
    });
    if (net > 0.009) {
      agingDebits.push({ amount: net, date: due });
    }
  }

  // Agrupar líneas de recibo por documento (monto neto a esta obra)
  const byReceipt = new Map<
    string,
    {
      id: string;
      number: string;
      issueDate: Date;
      currency: string;
      concept: string | null;
      factor: number;
      credit: number;
    }
  >();

  for (const line of receiptLines) {
    const r = line.receipt;
    let entry = byReceipt.get(r.id);
    if (!entry) {
      const receiptTotal = toNumber(r.totalAmount);
      const bounced = r.checks.reduce((acc, c) => acc + toNumber(c.amount), 0);
      const factor =
        receiptTotal > 0.009
          ? Math.max(0, (receiptTotal - bounced) / receiptTotal)
          : 1;
      entry = {
        id: r.id,
        number: r.number,
        issueDate: r.issueDate,
        currency: r.currency || currency,
        concept: r.concept,
        factor,
        credit: 0,
      };
      byReceipt.set(r.id, entry);
    }
    entry.credit = round2(entry.credit + toNumber(line.amount) * entry.factor);
  }

  for (const r of byReceipt.values()) {
    currency = r.currency || currency;
    const issued = parseDbDate(r.issueDate);
    const amount = round2(r.credit);
    if (amount <= 0.009) continue;
    movements.push({
      id: `rec-${r.id}`,
      date: isoDay(r.issueDate),
      kind: "RECEIPT",
      number: r.number,
      description: r.concept || "Recibo de cobro",
      debit: 0,
      credit: amount,
      currency: r.currency,
      href: `/treasury/receipts/${r.id}`,
      projectName: `${project.code} · ${project.name}`,
    });
    agingCredits.push({ amount, date: issued });
  }

  const balance = round2(
    movements.reduce((acc, m) => acc + m.debit - m.credit, 0),
  );
  const aging = buildAging(agingDebits, agingCredits, asOf);
  movements.sort((a, b) => a.date.localeCompare(b.date));

  return {
    partyId: project.client.id,
    partyName: project.client.name,
    partyKind: "client",
    currency,
    balance,
    aging,
    movements,
  };
}

export async function getSupplierAccountStatement(
  supplierId: string,
): Promise<AccountStatement | null> {
  const session = await requireSession();
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: session.organizationId },
    select: { id: true, name: true },
  });
  if (!supplier) return null;

  const [invoices, orders] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        supplierId,
        status: "CONFIRMED",
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.paymentOrder.findMany({
      where: {
        organizationId: session.organizationId,
        supplierId,
        status: "POSTED",
      },
      orderBy: { issueDate: "asc" },
    }),
  ]);

  const movements: AccountStatementMovement[] = [];
  const asOf = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );
  let currency = "ARS";
  const agingDebits: AgingItem[] = [];
  const agingCredits: AgingItem[] = [];

  for (const inv of invoices) {
    const total = toNumber(inv.totalAmount);
    currency = inv.currency || currency;
    const due = parseDbDate(inv.dueDate ?? inv.issueDate ?? inv.createdAt);
    movements.push({
      id: `inv-${inv.id}`,
      date: isoDay(inv.issueDate ?? inv.createdAt),
      kind: "INVOICE",
      number: inv.number,
      description: `Factura · ${inv.project.code} ${inv.project.name}`,
      debit: total,
      credit: 0,
      currency: inv.currency,
      href: `/projects/${inv.projectId}/purchases/${inv.id}`,
      projectName: `${inv.project.code} · ${inv.project.name}`,
    });
    if (total > 0.009) {
      agingDebits.push({ amount: total, date: due });
    }
  }

  for (const op of orders) {
    const amount = toNumber(op.totalAmount);
    currency = op.currency || currency;
    const issued = parseDbDate(op.issueDate);
    movements.push({
      id: `op-${op.id}`,
      date: isoDay(op.issueDate),
      kind: "PAYMENT_ORDER",
      number: op.number,
      description: op.concept || "Orden de pago",
      debit: 0,
      credit: amount,
      currency: op.currency,
      href: `/treasury/payment-orders/${op.id}`,
    });
    if (amount > 0.009) {
      agingCredits.push({ amount, date: issued });
    }
  }

  const balance = round2(
    movements.reduce((acc, m) => acc + m.debit - m.credit, 0),
  );
  const aging = buildAging(agingDebits, agingCredits, asOf);
  movements.sort((a, b) => a.date.localeCompare(b.date));

  return {
    partyId: supplier.id,
    partyName: supplier.name,
    partyKind: "supplier",
    currency,
    balance,
    aging,
    movements,
  };
}

/** Facturas confirmadas con saldo para aplicar en OP. */
export async function listOpenPurchaseInvoices(opts?: {
  supplierId?: string;
  projectId?: string;
}) {
  const session = await requireSession();
  const rows = await prisma.purchaseInvoice.findMany({
    where: {
      status: "CONFIRMED",
      ...(opts?.supplierId ? { supplierId: opts.supplierId } : {}),
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
      },
    },
    include: {
      project: { select: { code: true, name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    take: 100,
  });

  return rows
    .map((inv) => {
      const total = toNumber(inv.totalAmount);
      const paid = toNumber(inv.paidAmount);
      const balance = Math.round((total - paid) * 100) / 100;
      return {
        id: inv.id,
        number: inv.number,
        currency: inv.currency,
        total,
        paid,
        balance,
        dueDate: inv.dueDate
          ? inv.dueDate.toISOString().slice(0, 10)
          : null,
        projectLabel: `${inv.project.code} · ${inv.project.name}`,
        supplierName: inv.supplier?.name ?? inv.supplierName,
        label: `${inv.number} · saldo ${balance.toLocaleString("es-AR", {
          style: "currency",
          currency: inv.currency,
        })} · ${inv.project.code}`,
      };
    })
    .filter((i) => i.balance > 0.009);
}

/** Certificaciones aprobadas con saldo para aplicar en recibos. */
export async function listOpenCertifications(opts?: {
  clientId?: string;
  projectId?: string;
}) {
  const session = await requireSession();
  const rows = await prisma.certification.findMany({
    where: {
      status: { in: ["APPROVED", "PAID"] },
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
        ...(opts?.clientId ? { clientId: opts.clientId } : {}),
        ...(opts?.projectId ? { id: opts.projectId } : {}),
      },
    },
    include: {
      project: {
        select: { id: true, code: true, name: true, currency: true },
      },
    },
    orderBy: [{ periodEnd: "asc" }, { number: "asc" }],
    take: 100,
  });

  return rows
    .map((c) => {
      const net = toNumber(c.netAmount);
      const collected = toNumber(c.collectedAmount);
      const balance = Math.round((net - collected) * 100) / 100;
      const currency = c.project.currency || "ARS";
      return {
        id: c.id,
        number: c.number,
        currency,
        net,
        collected,
        balance,
        projectId: c.project.id,
        projectLabel: `${c.project.code} · ${c.project.name}`,
        label: `${c.number} · saldo ${balance.toLocaleString("es-AR", {
          style: "currency",
          currency,
        })} · ${c.project.code}`,
      };
    })
    .filter((c) => c.balance > 0.009);
}
