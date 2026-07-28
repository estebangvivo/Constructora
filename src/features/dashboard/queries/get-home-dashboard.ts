import { getSession } from "@/lib/auth";
import { hasModule, type AppModuleKey } from "@/features/auth/lib/modules";
import { sumByCurrency } from "@/config/currencies";
import { listReceipts, listPaymentOrders } from "@/features/treasury/queries/list-treasury";
import { getCashOverview } from "@/features/treasury/queries/cash-queries";
import { listBankAccounts } from "@/features/treasury/queries/bank-queries";
import {
  getChecksDueAlert,
  type ChecksDueAlert,
} from "@/features/treasury/queries/list-checks";
import { countProjectsByScope } from "@/features/projects/queries/get-projects";

export type HomeDashboardData = {
  periodLabel: string;
  prevPeriodLabel: string;
  dateFrom: string;
  dateTo: string;
  showTreasury: boolean;
  showProjects: boolean;
  incomePosted: Record<string, number>;
  expensePosted: Record<string, number>;
  netPosted: Record<string, number>;
  incomePrev: Record<string, number>;
  expensePrev: Record<string, number>;
  incomeDeltaLabel: string | null;
  expenseDeltaLabel: string | null;
  pendingReceipts: number;
  pendingOrders: number;
  cashDailyBalance: number | null;
  cashTreasuryBalance: number | null;
  cashCurrency: string;
  bankTotals: Record<string, number>;
  checks: ChecksDueAlert | null;
  checkPreview: ChecksDueAlert["overdue"];
  projectsOpen: number | null;
  projectsClosed: number | null;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function inRange(date: Date | string, start: Date, end: Date) {
  const t = new Date(date).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function monthLabel(d: Date) {
  const raw = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function dateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function rangeLabel(start: Date, end: Date) {
  if (
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
  ) {
    return monthLabel(start);
  }

  const fmt = new Intl.DateTimeFormat("es-AR");
  return `${fmt.format(start)} al ${fmt.format(end)}`;
}

function netByCurrency(
  income: Record<string, number>,
  expense: Record<string, number>,
): Record<string, number> {
  const keys = new Set([...Object.keys(income), ...Object.keys(expense)]);
  const net: Record<string, number> = {};
  for (const k of keys) {
    net[k] = (income[k] ?? 0) - (expense[k] ?? 0);
  }
  return net;
}

function totalAmount(totals: Record<string, number>) {
  return Object.values(totals).reduce((a, b) => a + b, 0);
}

function deltaLabel(
  current: Record<string, number>,
  previous: Record<string, number>,
): string | null {
  const cur = totalAmount(current);
  const prev = totalAmount(previous);
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return "vs período ant.: nuevo";
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const sign = pct > 0 ? "+" : "";
  return `vs período ant.: ${sign}${pct.toFixed(0)}%`;
}

/**
 * Métricas del inicio. Respeta módulos del usuario (tesorería / obras).
 */
export async function getHomeDashboardData(
  modules: AppModuleKey[] | string[],
  range?: {
    from?: Date;
    to?: Date;
  },
): Promise<HomeDashboardData | null> {
  const session = await getSession();
  if (!session) return null;

  const showTreasury = hasModule(modules, "treasury");
  const showProjects = hasModule(modules, "projects");

  if (!showTreasury && !showProjects) {
    const now = new Date();
    const defaultStart = startOfMonth(now);
    const defaultEnd = endOfMonth(now);
    return {
      periodLabel: rangeLabel(defaultStart, defaultEnd),
      prevPeriodLabel: monthLabel(
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      ),
      dateFrom: dateInputValue(defaultStart),
      dateTo: dateInputValue(defaultEnd),
      showTreasury: false,
      showProjects: false,
      incomePosted: {},
      expensePosted: {},
      netPosted: {},
      incomePrev: {},
      expensePrev: {},
      incomeDeltaLabel: null,
      expenseDeltaLabel: null,
      pendingReceipts: 0,
      pendingOrders: 0,
      cashDailyBalance: null,
      cashTreasuryBalance: null,
      cashCurrency: "ARS",
      bankTotals: {},
      checks: null,
      checkPreview: [],
      projectsOpen: null,
      projectsClosed: null,
    };
  }

  const now = new Date();
  const curStart = startOfDay(range?.from ?? startOfMonth(now));
  const curEnd = endOfDay(range?.to ?? endOfMonth(now));
  const spanMs = curEnd.getTime() - curStart.getTime();
  const prevEnd = new Date(curStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs);

  const [receipts, orders, cash, bankAccounts, checks, projectCounts] =
    await Promise.all([
      showTreasury ? listReceipts() : Promise.resolve([]),
      showTreasury ? listPaymentOrders() : Promise.resolve([]),
      showTreasury ? getCashOverview("ARS") : Promise.resolve(null),
      showTreasury
        ? listBankAccounts({ activeOnly: true })
        : Promise.resolve([]),
      showTreasury ? getChecksDueAlert() : Promise.resolve(null),
      showProjects
        ? countProjectsByScope({ from: curStart, to: curEnd })
        : Promise.resolve(null),
    ]);

  const postedReceipts = receipts.filter((r) => r.status === "POSTED");
  const postedOrders = orders.filter((o) => o.status === "POSTED");

  const incomePosted = sumByCurrency(
    postedReceipts
      .filter((r) => inRange(r.issueDate, curStart, curEnd))
      .map((r) => ({ currency: r.currency, amount: r.totalAmount })),
  );
  const expensePosted = sumByCurrency(
    postedOrders
      .filter((o) => inRange(o.issueDate, curStart, curEnd))
      .map((o) => ({ currency: o.currency, amount: o.totalAmount })),
  );
  const incomePrev = sumByCurrency(
    postedReceipts
      .filter((r) => inRange(r.issueDate, prevStart, prevEnd))
      .map((r) => ({ currency: r.currency, amount: r.totalAmount })),
  );
  const expensePrev = sumByCurrency(
    postedOrders
      .filter((o) => inRange(o.issueDate, prevStart, prevEnd))
      .map((o) => ({ currency: o.currency, amount: o.totalAmount })),
  );

  const bankTotals = sumByCurrency(
    bankAccounts.map((a) => ({ currency: a.currency, amount: a.balance })),
  );

  const checkPreview = checks
    ? [...checks.overdue, ...checks.dueSoon].slice(0, 5)
    : [];

  return {
    periodLabel: rangeLabel(curStart, curEnd),
    prevPeriodLabel: rangeLabel(prevStart, prevEnd),
    dateFrom: dateInputValue(curStart),
    dateTo: dateInputValue(curEnd),
    showTreasury,
    showProjects,
    incomePosted,
    expensePosted,
    netPosted: netByCurrency(incomePosted, expensePosted),
    incomePrev,
    expensePrev,
    incomeDeltaLabel: deltaLabel(incomePosted, incomePrev),
    expenseDeltaLabel: deltaLabel(expensePosted, expensePrev),
    pendingReceipts: receipts.filter(
      (r) =>
        (r.status === "DRAFT" || r.status === "ISSUED") &&
        inRange(r.issueDate, curStart, curEnd),
    ).length,
    pendingOrders: orders.filter(
      (o) =>
        (o.status === "DRAFT" || o.status === "ISSUED") &&
        inRange(o.issueDate, curStart, curEnd),
    ).length,
    cashDailyBalance: cash?.daily?.balance ?? null,
    cashTreasuryBalance: cash?.treasury?.balance ?? null,
    cashCurrency: cash?.daily?.currency ?? cash?.treasury?.currency ?? "ARS",
    bankTotals,
    checks,
    checkPreview,
    projectsOpen: projectCounts?.open ?? null,
    projectsClosed: projectCounts?.closed ?? null,
  };
}
