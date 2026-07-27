import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Limpia logos rotos (/uploads/…) que no existen en el FS de Railway. */
async function main() {
  const orgs = await prisma.organization.findMany({
    where: { logoUrl: { startsWith: "/uploads/" } },
    select: { id: true, name: true, logoUrl: true },
  });
  console.log(`Orgs with filesystem logos: ${orgs.length}`);
  for (const org of orgs) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { logoUrl: null },
    });
    console.log(`Cleared logo for ${org.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
