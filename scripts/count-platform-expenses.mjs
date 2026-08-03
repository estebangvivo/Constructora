import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// Load .env without depending on dotenv package (avoid PowerShell $ issues).
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv();

const prisma = new PrismaClient();

async function main() {
  // Prefer Prisma model API; fall back to raw SQL if needed.
  let count = null;
  let sample = [];
  let method = "prisma.platformSystemExpense";

  try {
    count = await prisma.platformSystemExpense.count();
    sample = await prisma.platformSystemExpense.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        date: true,
        amount: true,
        currency: true,
        category: true,
        title: true,
        createdByUserId: true,
      },
    });
  } catch (err) {
    method = "raw SQL";
    console.error("Prisma model query failed:", err?.message ?? err);
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM "platform_system_expenses"`,
      );
      count = rows?.[0]?.count ?? 0;
      sample = await prisma.$queryRawUnsafe(
        `SELECT id, date, amount, currency, category, title, "createdByUserId"
         FROM "platform_system_expenses"
         ORDER BY date DESC, "createdAt" DESC
         LIMIT 10`,
      );
    } catch (rawErr) {
      console.error("Raw SQL also failed:", rawErr?.message ?? rawErr);
      throw rawErr;
    }
  }

  let rawCount = null;
  let rawError = null;
  try {
    const rawRows = await prisma.$queryRawUnsafe(
      `SELECT id, date, category, title, notes, currency, amount, hours, vendor,
              "createdByUserId", "createdAt", "updatedAt"
       FROM "platform_system_expenses"
       WHERE 1=1
       ORDER BY date DESC, "createdAt" DESC
       LIMIT 500`,
    );
    rawCount = rawRows.length;
  } catch (e) {
    rawError = e?.message ?? String(e);
  }

  console.log(
    JSON.stringify(
      {
        method,
        count,
        rawListQueryCount: rawCount,
        rawListQueryError: rawError,
        sample: sample.map((r) => ({
          id: r.id,
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
          amount: r.amount != null ? String(r.amount) : null,
          currency: r.currency,
          category: r.category,
          title: r.title,
          createdByUserId: r.createdByUserId,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
