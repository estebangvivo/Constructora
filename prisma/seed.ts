import { PrismaClient, type ProjectStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEV_USER_AUTH_ID = "dev_user_constructora";
const DEV_ORG_SLUG = "demo-constructora";
const DEV_PASSWORD = "admin123";

const PROJECTS: {
  code: string;
  name: string;
  city: string;
  status: ProjectStatus;
  taskProgress: number[];
  clientKey: "inmobiliaria" | "retail" | "logistica";
  supplierKeys: string[];
}[] = [
  {
    code: "OB-2026-001",
    name: "Edificio Los Alerces",
    city: "Santiago",
    status: "ACTIVE",
    taskProgress: [40, 55, 30],
    clientKey: "inmobiliaria",
    supplierKeys: ["hormigones", "aceros"],
  },
  {
    code: "OB-2026-002",
    name: "Remodelación Costanera",
    city: "Viña del Mar",
    status: "ACTIVE",
    taskProgress: [10, 25],
    clientKey: "retail",
    supplierKeys: ["ferreteria"],
  },
  {
    code: "OB-2025-014",
    name: "Bodega Industrial Maipú",
    city: "Maipú",
    status: "ON_HOLD",
    taskProgress: [80, 70, 50],
    clientKey: "logistica",
    supplierKeys: ["hormigones", "ferreteria"],
  },
];

async function main() {
  console.log("🌱 Seeding Constructora…");

  const org = await prisma.organization.upsert({
    where: { slug: DEV_ORG_SLUG },
    create: {
      name: "Demo Constructora",
      slug: DEV_ORG_SLUG,
      taxId: "30-71234567-8",
      legalName: "Demo Constructora S.A.",
      email: "contacto@demo-constructora.local",
      phone: "+54 11 4000-0000",
      address: "Av. Corrientes 1234",
      city: "CABA",
      province: "Buenos Aires",
      country: "AR",
      themeId: "obra",
      currency: "ARS",
      enabledCurrencies: ["ARS", "USD"],
    },
    update: {
      name: "Demo Constructora",
      legalName: "Demo Constructora S.A.",
      taxId: "30-71234567-8",
      currency: "ARS",
      enabledCurrencies: ["ARS", "USD"],
    },
  });

  const passwordHash = await hash(DEV_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { authId: DEV_USER_AUTH_ID },
    create: {
      authId: DEV_USER_AUTH_ID,
      email: "admin@demo-constructora.local",
      passwordHash,
      firstName: "Esteban",
      lastName: "Admin",
    },
    update: {
      email: "admin@demo-constructora.local",
      firstName: "Esteban",
      lastName: "Admin",
      passwordHash,
      isActive: true,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: user.id,
      },
    },
    create: {
      organizationId: org.id,
      userId: user.id,
      role: "ADMIN",
      allowedModules: [],
    },
    update: {
      role: "ADMIN",
    },
  });

  const clientDefs = [
    {
      key: "inmobiliaria",
      name: "Inmobiliaria Los Andes SpA",
      taxId: "76.111.111-1",
      contactName: "Ana Fuentes",
      email: "ana@losandes.cl",
    },
    {
      key: "retail",
      name: "Retail Costanera S.A.",
      taxId: "96.222.222-2",
      contactName: "Pedro Núñez",
      email: "compras@costanera.cl",
    },
    {
      key: "logistica",
      name: "Logística Maipú Ltda.",
      taxId: "77.333.333-3",
      contactName: "Carla Díaz",
      email: "obras@logmaipu.cl",
    },
  ] as const;

  const clientsByKey: Record<string, string> = {};
  for (const def of clientDefs) {
    const existing = await prisma.client.findFirst({
      where: { organizationId: org.id, name: def.name },
    });
    const client =
      existing ??
      (await prisma.client.create({
        data: {
          organizationId: org.id,
          name: def.name,
          taxId: def.taxId,
          contactName: def.contactName,
          email: def.email,
        },
      }));
    clientsByKey[def.key] = client.id;
  }

  const supplierDefs = [
    {
      key: "hormigones",
      name: "Hormigones del Sur",
      taxId: "78.444.444-4",
      contactName: "Luis Pérez",
    },
    {
      key: "aceros",
      name: "Aceros Cordillera",
      taxId: "79.555.555-5",
      contactName: "Marta Rojas",
    },
    {
      key: "ferreteria",
      name: "Ferretería Industrial Andes",
      taxId: "76.666.666-6",
      contactName: "Jorge Silva",
    },
  ] as const;

  const suppliersByKey: Record<string, string> = {};
  for (const def of supplierDefs) {
    const existing = await prisma.supplier.findFirst({
      where: { organizationId: org.id, name: def.name },
    });
    const supplier =
      existing ??
      (await prisma.supplier.create({
        data: {
          organizationId: org.id,
          name: def.name,
          taxId: def.taxId,
          contactName: def.contactName,
        },
      }));
    suppliersByKey[def.key] = supplier.id;
  }

  for (const item of PROJECTS) {
    const project = await prisma.project.upsert({
      where: {
        organizationId_code: {
          organizationId: org.id,
          code: item.code,
        },
      },
      create: {
        organizationId: org.id,
        createdById: user.id,
        clientId: clientsByKey[item.clientKey],
        code: item.code,
        name: item.name,
        city: item.city,
        status: item.status,
        currency: "CLP",
        members: {
          create: {
            userId: user.id,
            role: "ADMIN",
          },
        },
      },
      update: {
        name: item.name,
        city: item.city,
        status: item.status,
        clientId: clientsByKey[item.clientKey],
        deletedAt: null,
      },
    });

    await prisma.projectMembership.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: user.id,
        },
      },
      create: {
        projectId: project.id,
        userId: user.id,
        role: "ADMIN",
      },
      update: {
        role: "ADMIN",
      },
    });

    for (const [index, supplierKey] of item.supplierKeys.entries()) {
      const supplierId = suppliersByKey[supplierKey];
      if (!supplierId) continue;
      await prisma.projectSupplier.upsert({
        where: {
          projectId_supplierId: {
            projectId: project.id,
            supplierId,
          },
        },
        create: {
          projectId: project.id,
          supplierId,
          isPrimary: index === 0,
          roleNotes: supplierKey,
        },
        update: {
          isPrimary: index === 0,
        },
      });
    }

    const taskCount = await prisma.task.count({
      where: { projectId: project.id },
    });

    if (taskCount === 0) {
      const base = project.startDate ?? new Date();
      await prisma.task.createMany({
        data: item.taskProgress.map((progressPct, index) => {
          const start = new Date(base);
          start.setDate(start.getDate() + index * 10);
          const end = new Date(start);
          end.setDate(end.getDate() + 9);
          return {
            projectId: project.id,
            name: `Tarea demo ${index + 1}`,
            status:
              progressPct >= 100
                ? ("COMPLETED" as const)
                : progressPct > 0
                  ? ("IN_PROGRESS" as const)
                  : ("NOT_STARTED" as const),
            progressPct,
            plannedStart: start,
            plannedEnd: end,
            sortOrder: index,
          };
        }),
      });
    }

    const budgetCount = await prisma.budget.count({
      where: { projectId: project.id },
    });
    if (budgetCount === 0) {
      await prisma.budget.create({
        data: {
          projectId: project.id,
          name: "Presupuesto Base",
          version: 1,
          status: "APPROVED",
          currency: "ARS",
          approvedAt: new Date(),
          items: {
            create: [
              {
                code: "01.01",
                description: "Excavación y movimiento de suelos",
                quantity: 120,
                unit: "m³",
                unitCost: 18500,
                totalCost: 2_220_000,
                sortOrder: 0,
              },
              {
                code: "01.02",
                description: "Hormigón fundaciones H25",
                quantity: 85,
                unit: "m³",
                unitCost: 95000,
                totalCost: 8_075_000,
                sortOrder: 1,
              },
              {
                code: "02.01",
                description: "Muro albañilería 15 cm",
                quantity: 340,
                unit: "m²",
                unitCost: 22000,
                totalCost: 7_480_000,
                sortOrder: 2,
              },
            ],
          },
        },
      });
    }
  }

  console.log("✅ Seed OK");
  console.log(`   Org:  ${org.name} (${org.slug})`);
  console.log(`   User: ${user.email} / contraseña: ${DEV_PASSWORD}`);
  console.log(`   Clientes: ${clientDefs.length}`);
  console.log(`   Proveedores: ${supplierDefs.length}`);
  console.log(`   Obras: ${PROJECTS.length}`);

  // Segunda empresa (aislamiento multi-tenant local)
  const SECOND_ORG_SLUG = "otra-constructora";
  const SECOND_PASSWORD = "admin123";

  const orgB = await prisma.organization.upsert({
    where: { slug: SECOND_ORG_SLUG },
    create: {
      name: "Otra Constructora",
      slug: SECOND_ORG_SLUG,
      taxId: "30-70000000-1",
      legalName: "Otra Constructora S.A.",
      email: "contacto@otra-constructora.local",
      phone: "+54 11 5000-0000",
      city: "Rosario",
      province: "Santa Fe",
      country: "AR",
      themeId: "obra",
      currency: "ARS",
      enabledCurrencies: ["ARS", "USD"],
    },
    update: {
      // No pisar el nombre comercial si ya se renombró en producción (p.ej. Buñas SAS)
    },
  });

  const userB = await prisma.user.upsert({
    where: { email: "admin@otra-constructora.local" },
    create: {
      authId: "local:admin@otra-constructora.local",
      email: "admin@otra-constructora.local",
      passwordHash: await hash(SECOND_PASSWORD, 10),
      firstName: "Admin",
      lastName: "Otra",
      isActive: true,
    },
    update: {
      passwordHash: await hash(SECOND_PASSWORD, 10),
      firstName: "Admin",
      lastName: "Otra",
      isActive: true,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: orgB.id,
        userId: userB.id,
      },
    },
    create: {
      organizationId: orgB.id,
      userId: userB.id,
      role: "ADMIN",
      allowedModules: [],
    },
    update: { role: "ADMIN" },
  });

  // El admin demo también puede entrar a la segunda org (para probar el selector)
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: orgB.id,
        userId: user.id,
      },
    },
    create: {
      organizationId: orgB.id,
      userId: user.id,
      role: "ADMIN",
      allowedModules: [],
    },
    update: { role: "ADMIN" },
  });

  const clientB =
    (await prisma.client.findFirst({
      where: { organizationId: orgB.id, name: "Cliente Exclusivo B" },
    })) ??
    (await prisma.client.create({
      data: {
        organizationId: orgB.id,
        name: "Cliente Exclusivo B",
        taxId: "20-11111111-1",
        contactName: "Solo Org B",
      },
    }));

  await prisma.project.upsert({
    where: {
      organizationId_code: {
        organizationId: orgB.id,
        code: "OB-B-001",
      },
    },
    create: {
      organizationId: orgB.id,
      createdById: userB.id,
      clientId: clientB.id,
      code: "OB-B-001",
      name: "Obra Solo Empresa B",
      city: "Rosario",
      status: "ACTIVE",
      currency: "ARS",
      members: {
        create: {
          userId: userB.id,
          role: "ADMIN",
        },
      },
    },
    update: {
      name: "Obra Solo Empresa B",
      clientId: clientB.id,
      deletedAt: null,
    },
  });

  console.log("✅ Seed segunda empresa OK");
  console.log(`   Org B: ${orgB.name} (${orgB.slug})`);
  console.log(`   User B: ${userB.email} / ${SECOND_PASSWORD}`);
  console.log(
    `   ${user.email} también es ADMIN de Org B (selector al login)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
