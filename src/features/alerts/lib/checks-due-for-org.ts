import { prisma } from "@/lib/prisma";
import type {
  CheckDueAlertItem,
  ChecksDueAlert,
} from "@/features/treasury/queries/list-checks";

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function parseDbDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

/** Misma lógica que getChecksDueAlert, sin sesión (para cron). */
export async function getChecksDueAlertForOrganization(
  organizationId: string,
): Promise<ChecksDueAlert> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { checkDueAlertDays: true },
  });
  const alertDays = Math.max(0, org?.checkDueAlertDays ?? 7);
  const today = startOfLocalDay();
  const horizon = addLocalDays(today, alertDays);

  const rows = await prisma.checkInstrument.findMany({
    where: {
      organizationId,
      OR: [
        { kind: "THIRD_PARTY", status: "IN_PORTFOLIO" },
        { kind: "OWN", status: "DELIVERED" },
      ],
      dueDate: {
        not: null,
        lte: new Date(
          Date.UTC(
            horizon.getFullYear(),
            horizon.getMonth(),
            horizon.getDate(),
          ),
        ),
      },
    },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    take: 50,
  });

  const overdue: CheckDueAlertItem[] = [];
  const dueSoon: CheckDueAlertItem[] = [];

  for (const row of rows) {
    if (!row.dueDate) continue;
    const due = parseDbDate(row.dueDate);
    const daysUntilDue = Math.round(
      (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    const item: CheckDueAlertItem = {
      id: row.id,
      number: row.number,
      bank: row.bank,
      amount: toNumber(row.amount),
      currency: row.currency,
      dueDate: due,
      drawerName: row.drawerName,
      daysUntilDue,
      kind: row.kind === "OWN" ? "OWN" : "THIRD_PARTY",
    };
    if (daysUntilDue < 0) overdue.push(item);
    else dueSoon.push(item);
  }

  return {
    alertDays,
    overdue,
    dueSoon,
    total: overdue.length + dueSoon.length,
  };
}
