/**
 * Marca todas las organizaciones existentes como EXEMPT (no cortar acceso).
 * Uso: npx tsx prisma/mark-orgs-exempt.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.organization.updateMany({
    data: { billingStatus: "EXEMPT" },
  });
  console.log(`OK: ${result.count} organización(es) → EXEMPT`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
