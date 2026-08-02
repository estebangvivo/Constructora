import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { PlatformExpenseCategory } from "@/features/platform-expenses/lib/categories";

export type PlatformExpenseRow = {
  id: string;
  date: string; // YYYY-MM-DD
  category: PlatformExpenseCategory;
  title: string;
  notes: string | null;
  currency: "ARS" | "USD";
  amount: number;
  hours: number | null;
  vendor: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbRow = {
  id: string;
  date: Date;
  category: string;
  title: string;
  notes: string | null;
  currency: string;
  amount: unknown;
  hours: unknown;
  vendor: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function newId() {
  return `c${randomBytes(12).toString("hex")}`;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

function mapRow(r: DbRow): PlatformExpenseRow {
  return {
    id: r.id,
    date: toIsoDate(r.date),
    category: r.category as PlatformExpenseCategory,
    title: r.title,
    notes: r.notes,
    currency: r.currency === "USD" ? "USD" : "ARS",
    amount: num(r.amount),
    hours: r.hours == null ? null : num(r.hours),
    vendor: r.vendor,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export type ExpenseListFilters = {
  from?: string | null;
  to?: string | null;
  category?: string | null;
  currency?: string | null;
};

export async function dbListPlatformExpenses(
  filters: ExpenseListFilters,
): Promise<PlatformExpenseRow[]> {
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  let i = 1;

  if (filters.from?.trim()) {
    clauses.push(`date >= $${i}::date`);
    params.push(filters.from.trim());
    i++;
  }
  if (filters.to?.trim()) {
    clauses.push(`date <= $${i}::date`);
    params.push(filters.to.trim());
    i++;
  }
  if (filters.category?.trim() && filters.category !== "ANY") {
    clauses.push(`category = $${i}::"PlatformSystemExpenseCategory"`);
    params.push(filters.category.trim());
    i++;
  }
  if (filters.currency?.trim() && filters.currency !== "ANY") {
    clauses.push(`currency = $${i}`);
    params.push(filters.currency.trim().toUpperCase());
    i++;
  }

  const rows = await prisma.$queryRawUnsafe<DbRow[]>(
    `SELECT id, date, category, title, notes, currency, amount, hours, vendor,
            "createdByUserId", "createdAt", "updatedAt"
     FROM "platform_system_expenses"
     WHERE ${clauses.join(" AND ")}
     ORDER BY date DESC, "createdAt" DESC
     LIMIT 500`,
    ...params,
  );
  return rows.map(mapRow);
}

export async function dbCreatePlatformExpense(input: {
  date: string;
  category: PlatformExpenseCategory;
  title: string;
  notes: string | null;
  currency: "ARS" | "USD";
  amount: number;
  hours: number | null;
  vendor: string | null;
  createdByUserId: string | null;
}): Promise<PlatformExpenseRow> {
  const id = newId();
  const rows = await prisma.$queryRawUnsafe<DbRow[]>(
    `INSERT INTO "platform_system_expenses"
       (id, date, category, title, notes, currency, amount, hours, vendor, "createdByUserId", "createdAt", "updatedAt")
     VALUES
       ($1, $2::date, $3::"PlatformSystemExpenseCategory", $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
     RETURNING id, date, category, title, notes, currency, amount, hours, vendor,
               "createdByUserId", "createdAt", "updatedAt"`,
    id,
    input.date,
    input.category,
    input.title,
    input.notes,
    input.currency,
    input.amount,
    input.hours,
    input.vendor,
    input.createdByUserId,
  );
  if (!rows[0]) throw new Error("No se pudo crear el gasto.");
  return mapRow(rows[0]);
}

export async function dbUpdatePlatformExpense(input: {
  id: string;
  date: string;
  category: PlatformExpenseCategory;
  title: string;
  notes: string | null;
  currency: "ARS" | "USD";
  amount: number;
  hours: number | null;
  vendor: string | null;
}): Promise<PlatformExpenseRow | null> {
  const rows = await prisma.$queryRawUnsafe<DbRow[]>(
    `UPDATE "platform_system_expenses"
     SET date = $2::date,
         category = $3::"PlatformSystemExpenseCategory",
         title = $4,
         notes = $5,
         currency = $6,
         amount = $7,
         hours = $8,
         vendor = $9,
         "updatedAt" = NOW()
     WHERE id = $1
     RETURNING id, date, category, title, notes, currency, amount, hours, vendor,
               "createdByUserId", "createdAt", "updatedAt"`,
    input.id,
    input.date,
    input.category,
    input.title,
    input.notes,
    input.currency,
    input.amount,
    input.hours,
    input.vendor,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function dbDeletePlatformExpense(id: string): Promise<boolean> {
  const n = await prisma.$executeRawUnsafe(
    `DELETE FROM "platform_system_expenses" WHERE id = $1`,
    id,
  );
  return n > 0;
}

export function computeExpenseTotals(rows: PlatformExpenseRow[]) {
  let totalArs = 0;
  let totalUsd = 0;
  let totalHours = 0;
  for (const r of rows) {
    if (r.currency === "ARS") totalArs += r.amount;
    else totalUsd += r.amount;
    if (r.hours != null) totalHours += r.hours;
  }
  return {
    totalArs: Math.round(totalArs * 100) / 100,
    totalUsd: Math.round(totalUsd * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    count: rows.length,
  };
}
