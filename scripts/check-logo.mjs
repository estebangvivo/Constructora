import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true, logoUrl: true },
  });
  console.log(
    JSON.stringify(
      {
        id: org?.id,
        name: org?.name,
        logoUrl: org?.logoUrl
          ? org.logoUrl.startsWith("data:")
            ? `data:(${org.logoUrl.length} chars)`
            : org.logoUrl
          : null,
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
