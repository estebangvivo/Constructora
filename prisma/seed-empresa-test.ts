/**
 * Seed rico para "Empresa de Test" (~1 año de operación).
 *
 * Uso:
 *   npx tsx prisma/seed-empresa-test.ts
 *   FORCE_RESEED_EMPRESA_TEST=1 npx tsx prisma/seed-empresa-test.ts
 *
 * Seguridad: solo crea/limpia datos de slug "empresa-de-test".
 * Nunca modifica otras organizaciones (p.ej. Buñas S.A.S.).
 * Si la empresa ya tiene obras, hace skip (salvo --force / FORCE_RESEED_EMPRESA_TEST=1).
 */
import {
  PrismaClient,
  type PaymentMethod,
  type ProjectStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const ORG_SLUG = "empresa-de-test";

function d(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function money(n: number) {
  return Math.round(n * 100) / 100;
}

function pad(n: number, w = 4) {
  return String(n).padStart(w, "0");
}

async function wipeOrgOperationalData(organizationId: string) {
  // Orden respetando FKs
  await prisma.receiptCertificationApplication.deleteMany({
    where: { receipt: { organizationId } },
  });
  await prisma.paymentOrderInvoiceApplication.deleteMany({
    where: { paymentOrder: { organizationId } },
  });
  await prisma.checkInstrument.deleteMany({ where: { organizationId } });
  await prisma.receiptPayment.deleteMany({
    where: { receipt: { organizationId } },
  });
  await prisma.receiptLine.deleteMany({
    where: { receipt: { organizationId } },
  });
  await prisma.receipt.deleteMany({ where: { organizationId } });
  await prisma.paymentOrderPayment.deleteMany({
    where: { paymentOrder: { organizationId } },
  });
  await prisma.paymentOrderLine.deleteMany({
    where: { paymentOrder: { organizationId } },
  });
  await prisma.paymentOrder.deleteMany({ where: { organizationId } });
  await prisma.cashMovement.deleteMany({ where: { organizationId } });
  await prisma.cashSession.deleteMany({ where: { organizationId } });
  await prisma.bankMovement.deleteMany({ where: { organizationId } });
  await prisma.bankAccount.deleteMany({ where: { organizationId } });
  await prisma.cashRegister.deleteMany({ where: { organizationId } });
  await prisma.inventoryMovement.deleteMany({
    where: { inventoryItem: { project: { organizationId } } },
  });
  await prisma.purchaseInvoiceItem.deleteMany({
    where: { purchaseInvoice: { project: { organizationId } } },
  });
  await prisma.purchaseInvoice.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.purchaseOrderItem.deleteMany({
    where: { purchaseOrder: { project: { organizationId } } },
  });
  await prisma.purchaseOrder.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.supplierQuoteItem.deleteMany({
    where: { supplierQuote: { purchaseRequest: { project: { organizationId } } } },
  });
  await prisma.supplierQuote.deleteMany({
    where: { purchaseRequest: { project: { organizationId } } },
  });
  await prisma.purchaseRequestItem.deleteMany({
    where: { purchaseRequest: { project: { organizationId } } },
  });
  await prisma.purchaseRequest.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.inventoryItem.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.documentVersion.deleteMany({
    where: { document: { project: { organizationId } } },
  });
  await prisma.document.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.punchListItem.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.dailyReportIncident.deleteMany({
    where: { dailyReport: { project: { organizationId } } },
  });
  await prisma.dailyReportAdvance.deleteMany({
    where: { dailyReport: { project: { organizationId } } },
  });
  await prisma.dailyReportEquipment.deleteMany({
    where: { dailyReport: { project: { organizationId } } },
  });
  await prisma.dailyReportWorkforce.deleteMany({
    where: { dailyReport: { project: { organizationId } } },
  });
  await prisma.dailyReport.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.certificationItem.deleteMany({
    where: { certification: { project: { organizationId } } },
  });
  await prisma.certification.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.budgetItem.deleteMany({
    where: { budget: { project: { organizationId } } },
  });
  await prisma.budget.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.task.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.projectSupplier.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.projectMembership.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.project.deleteMany({ where: { organizationId } });
  await prisma.client.deleteMany({ where: { organizationId } });
  await prisma.supplier.deleteMany({ where: { organizationId } });
}

async function ensureEmpresaDeTestOrg() {
  let org = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Empresa de Test",
        slug: ORG_SLUG,
        taxId: "30-70999999-0",
        legalName: "Empresa de Test S.A.",
        email: "admin@empresa-de-test.local",
        phone: "+54 341 400-0000",
        city: "Rosario",
        province: "Santa Fe",
        country: "AR",
        themeId: "obra",
        currency: "ARS",
        enabledCurrencies: ["ARS", "USD"],
      },
    });
    console.log(`   Creada organización: ${org.name} (${org.id})`);
  }

  // Admin: preferir un ADMIN/DIRECTOR de otra empresa (p.ej. Buñas) para poder cambiar de org
  let member = await prisma.organizationMember.findFirst({
    where: { organizationId: org.id, role: { in: ["ADMIN", "DIRECTOR"] } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  if (!member) {
    const donorWhere = {
      role: { in: ["ADMIN", "DIRECTOR"] as const },
      organization: { slug: { not: ORG_SLUG } },
    };
    const donor =
      (await prisma.organizationMember.findFirst({
        where: {
          ...donorWhere,
          organization: {
            slug: { not: ORG_SLUG },
            OR: [
              { name: { contains: "Buñ", mode: "insensitive" } },
              { name: { contains: "Bunas", mode: "insensitive" } },
              { legalName: { contains: "Buñ", mode: "insensitive" } },
              { legalName: { contains: "Bunas", mode: "insensitive" } },
            ],
          },
        },
        include: { user: true, organization: true },
        orderBy: { createdAt: "asc" },
      })) ??
      (await prisma.organizationMember.findFirst({
        where: donorWhere,
        include: { user: true, organization: true },
        orderBy: { createdAt: "asc" },
      }));
    if (!donor) {
      throw new Error(
        "No hay ningún Admin/Dirección en el sistema para asociar a Empresa de Test.",
      );
    }
    member = await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: donor.userId,
        role: "ADMIN",
      },
      include: { user: true },
    });
    console.log(
      `   Asociado admin ${donor.user.email} (desde ${donor.organization.name})`,
    );
  }

  return { org, member };
}

async function main() {
  const forceReseed =
    process.env.FORCE_RESEED_EMPRESA_TEST === "1" ||
    process.argv.includes("--force");

  console.log(`🌱 Seed Empresa de Test (${ORG_SLUG})…`);
  console.log(
    "   Alcance: SOLO esta empresa. Otras orgs (p.ej. Buñas) no se modifican.",
  );

  const { org, member } = await ensureEmpresaDeTestOrg();
  const userId = member.userId;
  const orgId = org.id;

  // Guardrail: nunca operar sobre otro slug
  if (org.slug !== ORG_SLUG) {
    throw new Error(`Abortado: slug inesperado ${org.slug}`);
  }

  const existingProjects = await prisma.project.count({
    where: { organizationId: orgId },
  });
  if (existingProjects > 0 && !forceReseed) {
    console.log(
      `⏭️  Empresa de Test ya tiene ${existingProjects} obra(s). Skip (usar FORCE_RESEED_EMPRESA_TEST=1 o --force para recrear).`,
    );
    return;
  }

  console.log(`   Org: ${org.name} (${org.id})`);
  console.log(`   User: ${member.user.email}`);
  console.log("   Limpiando datos operativos previos de ESTA empresa…");
  await wipeOrgOperationalData(orgId);

  // —— Clientes ——
  const clientDefs = [
    {
      name: "Inmobiliaria Puerto Norte S.A.",
      taxId: "30-71234568-9",
      contactName: "Laura Méndez",
      email: "laura@puertonorte.com",
      phone: "+54 341 455-1000",
    },
    {
      name: "Municipalidad de Rosario",
      taxId: "30-99999999-7",
      contactName: "Dir. Obras Públicas",
      email: "obras@rosario.gob.ar",
      phone: "+54 341 480-2000",
    },
    {
      name: "Logística del Litoral SRL",
      taxId: "30-70888888-1",
      contactName: "Martín Acosta",
      email: "macosta@loglitoral.com",
      phone: "+54 341 422-3300",
    },
    {
      name: "Grupo Habitar Desarrollos",
      taxId: "30-71555555-3",
      contactName: "Sofía Rinaldi",
      email: "sofia@grupohabitar.com",
      phone: "+54 11 5278-9000",
    },
    {
      name: "Fideicomiso Torres del Parque",
      taxId: "30-71777777-2",
      contactName: "Administración",
      email: "admin@torresdelparque.com",
    },
  ];

  const clients: { id: string; name: string }[] = [];
  for (const c of clientDefs) {
    const row = await prisma.client.create({
      data: { organizationId: orgId, ...c, isActive: true },
    });
    clients.push(row);
  }

  // —— Proveedores ——
  const supplierDefs = [
    { name: "Hormigones Rosario SA", taxId: "30-61111111-1", contactName: "Planta" },
    { name: "Aceros del Paraná", taxId: "30-62222222-2", contactName: "Ventas" },
    { name: "Corralón San Martín", taxId: "30-63333333-3", contactName: "Mostrador" },
    { name: "Electricidad Industrial Sur", taxId: "30-64444444-4", contactName: "Técnica" },
    { name: "Sanitarios y Grifería Centro", taxId: "30-65555555-5", contactName: "Depósito" },
    { name: "Pinturerías del Sol", taxId: "30-66666666-6", contactName: "Mayoreo" },
    { name: "Alquiler de Andamios Norte", taxId: "30-67777777-7", contactName: "Logística" },
    { name: "Seguridad e Higiene Pro", taxId: "30-68888888-8", contactName: "RRHH" },
  ];

  const suppliers: { id: string; name: string }[] = [];
  for (const s of supplierDefs) {
    const row = await prisma.supplier.create({
      data: { organizationId: orgId, ...s, isActive: true },
    });
    suppliers.push(row);
  }

  // —— Bancos ——
  const bankGalicia = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      name: "Galicia operativa",
      bankName: "Banco Galicia",
      accountNumber: "4012-3456789-0",
      cbu: "0070123456789012345678",
      alias: "EMPRESA.TEST.GAL",
      currency: "ARS",
      balance: 0,
      isActive: true,
    },
  });
  const bankNacion = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      name: "Nación sueldos",
      bankName: "Banco Nación",
      accountNumber: "123456789012",
      cbu: "0110123456789012345678",
      alias: "EMPRESA.TEST.BNA",
      currency: "ARS",
      balance: 0,
      isActive: true,
    },
  });

  let balG = 8_000_000;
  let balN = 3_500_000;
  await prisma.bankAccount.update({
    where: { id: bankGalicia.id },
    data: { balance: balG },
  });
  await prisma.bankAccount.update({
    where: { id: bankNacion.id },
    data: { balance: balN },
  });
  await prisma.bankMovement.createMany({
    data: [
      {
        organizationId: orgId,
        bankAccountId: bankGalicia.id,
        type: "OPENING",
        amount: balG,
        balanceAfter: balG,
        description: "Saldo inicial cuenta operativa",
        occurredAt: d(2025, 7, 1),
        createdById: userId,
      },
      {
        organizationId: orgId,
        bankAccountId: bankNacion.id,
        type: "OPENING",
        amount: balN,
        balanceAfter: balN,
        description: "Saldo inicial cuenta sueldos",
        occurredAt: d(2025, 7, 1),
        createdById: userId,
      },
    ],
  });

  // —— Cajas ——
  const daily = await prisma.cashRegister.create({
    data: {
      organizationId: orgId,
      type: "DAILY",
      name: "Caja diaria (ARS)",
      currency: "ARS",
      balance: 0,
    },
  });
  const treasury = await prisma.cashRegister.create({
    data: {
      organizationId: orgId,
      type: "TREASURY",
      name: "Caja tesorería (ARS)",
      currency: "ARS",
      balance: 150_000,
    },
  });
  await prisma.cashMovement.create({
    data: {
      organizationId: orgId,
      registerId: treasury.id,
      type: "TREASURY_IN",
      amount: 150_000,
      balanceAfter: 150_000,
      description: "Fondo inicial tesorería",
      occurredAt: d(2025, 7, 1),
      createdById: userId,
    },
  });

  // —— Obras ——
  type ProjectSeed = {
    code: string;
    name: string;
    city: string;
    status: ProjectStatus;
    clientIdx: number;
    start: Date;
    end?: Date;
    supplierIdx: number[];
    budgetTotal: number;
  };

  const projectSeeds: ProjectSeed[] = [
    {
      code: "OB-2025-001",
      name: "Edificio residencial Oroño 1200",
      city: "Rosario",
      status: "COMPLETED",
      clientIdx: 0,
      start: d(2025, 3, 1),
      end: d(2025, 12, 15),
      supplierIdx: [0, 1, 2],
      budgetTotal: 85_000_000,
    },
    {
      code: "OB-2025-002",
      name: "Remodelación sede municipal zona norte",
      city: "Rosario",
      status: "COMPLETED",
      clientIdx: 1,
      start: d(2025, 5, 1),
      end: d(2026, 1, 20),
      supplierIdx: [2, 3, 5],
      budgetTotal: 22_000_000,
    },
    {
      code: "OB-2025-003",
      name: "Nave logística Puerto San Martín",
      city: "Puerto San Martín",
      status: "ACTIVE",
      clientIdx: 2,
      start: d(2025, 9, 1),
      supplierIdx: [0, 1, 6],
      budgetTotal: 120_000_000,
    },
    {
      code: "OB-2026-001",
      name: "Torres del Parque — etapa 1",
      city: "Funes",
      status: "ACTIVE",
      clientIdx: 4,
      start: d(2026, 1, 10),
      supplierIdx: [0, 1, 2, 4],
      budgetTotal: 210_000_000,
    },
    {
      code: "OB-2026-002",
      name: "Showroom Grupo Habitar",
      city: "Rosario",
      status: "ON_HOLD",
      clientIdx: 3,
      start: d(2026, 2, 1),
      supplierIdx: [3, 5],
      budgetTotal: 8_500_000,
    },
    {
      code: "OB-2026-003",
      name: "Ampliación depósito Logística Litoral",
      city: "Pérez",
      status: "ACTIVE",
      clientIdx: 2,
      start: d(2026, 4, 1),
      supplierIdx: [0, 6, 7],
      budgetTotal: 35_000_000,
    },
  ];

  const projects: {
    id: string;
    code: string;
    name: string;
    clientId: string;
    budgetItemIds: string[];
    budgetTotal: number;
    status: ProjectStatus;
    supplierIds: string[];
    start: Date;
  }[] = [];

  for (const ps of projectSeeds) {
    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        clientId: clients[ps.clientIdx].id,
        code: ps.code,
        name: ps.name,
        city: ps.city,
        status: ps.status,
        currency: "ARS",
        startDate: ps.start,
        endDate: ps.end ?? null,
        description: `Obra demo seed — ${ps.name}`,
        members: {
          create: { userId, role: "ADMIN" },
        },
      },
    });

    for (const [i, sIdx] of ps.supplierIdx.entries()) {
      await prisma.projectSupplier.create({
        data: {
          projectId: project.id,
          supplierId: suppliers[sIdx].id,
          isPrimary: i === 0,
        },
      });
    }

    const itemShare = [
      { code: "01.01", description: "Movimiento de suelos", w: 0.12 },
      { code: "01.02", description: "Hormigón y fundaciones", w: 0.28 },
      { code: "02.01", description: "Estructura y mampostería", w: 0.25 },
      { code: "03.01", description: "Instalaciones", w: 0.2 },
      { code: "04.01", description: "Terminaciones", w: 0.15 },
    ];

    const budget = await prisma.budget.create({
      data: {
        projectId: project.id,
        name: "Presupuesto base",
        version: 1,
        status: "APPROVED",
        currency: "ARS",
        approvedAt: ps.start,
        items: {
          create: itemShare.map((it, idx) => {
            const totalCost = money(ps.budgetTotal * it.w);
            return {
              code: it.code,
              description: it.description,
              quantity: 1,
              unit: "glb",
              unitCost: totalCost,
              totalCost,
              currency: "ARS",
              sortOrder: idx,
            };
          }),
        },
      },
      include: { items: true },
    });

    // Tareas de cronograma
    await prisma.task.createMany({
      data: [25, 50, 75, 100].map((progressPct, index) => {
        const start = new Date(ps.start);
        start.setUTCDate(start.getUTCDate() + index * 45);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 40);
        const done =
          ps.status === "COMPLETED" ||
          (ps.status === "ACTIVE" && progressPct <= 50);
        return {
          projectId: project.id,
          name: `Etapa ${index + 1}`,
          status: done
            ? progressPct >= 100
              ? ("COMPLETED" as const)
              : ("IN_PROGRESS" as const)
            : ("NOT_STARTED" as const),
          progressPct: ps.status === "COMPLETED" ? 100 : Math.min(progressPct, 70),
          plannedStart: start,
          plannedEnd: end,
          sortOrder: index,
        };
      }),
    });

    projects.push({
      id: project.id,
      code: project.code,
      name: project.name,
      clientId: clients[ps.clientIdx].id,
      budgetItemIds: budget.items.map((i) => i.id),
      budgetTotal: ps.budgetTotal,
      status: ps.status,
      supplierIds: ps.supplierIdx.map((i) => suppliers[i].id),
      start: ps.start,
    });
  }

  // —— Certificaciones mensuales (obras activas/completadas) ——
  let certSeq = 1;
  for (const p of projects) {
    if (p.status === "ON_HOLD" || p.status === "DRAFT") continue;
    const months = p.status === "COMPLETED" ? 6 : 8;
    let prevPct = 0;
    for (let m = 0; m < months; m++) {
      const periodEnd = d(2025, 8 + m, 28);
      if (periodEnd > new Date()) break;
      const currentPct = Math.min(100, money(((m + 1) / months) * 100));
      const periodPct = money(currentPct - prevPct);
      const gross = money((p.budgetTotal * periodPct) / 100);
      const retentionPct = 5;
      const retentionAmount = money((gross * retentionPct) / 100);
      const netAmount = money(gross - retentionAmount);
      const itemAmount = money(gross / p.budgetItemIds.length);

      const cert = await prisma.certification.create({
        data: {
          projectId: p.id,
          number: `CERT-${pad(certSeq++)}`,
          periodStart: d(2025, 8 + m, 1),
          periodEnd,
          status: m < months - 1 || p.status === "COMPLETED" ? "PAID" : "APPROVED",
          grossAmount: gross,
          retentionPct,
          retentionAmount,
          netAmount,
          collectedAmount:
            m < months - 1 || p.status === "COMPLETED" ? netAmount : money(netAmount * 0.6),
          approvedAt: periodEnd,
          paidAt:
            m < months - 1 || p.status === "COMPLETED" ? d(2025, 8 + m, 30) : null,
          items: {
            create: p.budgetItemIds.map((budgetItemId) => ({
              budgetItemId,
              previousPct: prevPct,
              currentPct,
              periodPct,
              amount: itemAmount,
            })),
          },
        },
      });
      void cert;
      prevPct = currentPct;
    }
  }

  // —— Sesiones de caja + recibos + OP (mensual) ——
  let recN = 1;
  let opN = 1;
  let cajaN = 1;
  let dailyBal = 0;
  let treasuryBal = 150_000;

  const months: { y: number; m: number }[] = [];
  for (let m = 7; m <= 12; m++) months.push({ y: 2025, m });
  for (let m = 1; m <= 7; m++) months.push({ y: 2026, m });

  for (const { y, m } of months) {
    const businessDate = d(y, m, 5);
    const sessionNumber = `CAJA-${y}-${pad(cajaN++)}`;
    const session = await prisma.cashSession.create({
      data: {
        organizationId: orgId,
        registerId: daily.id,
        number: sessionNumber,
        businessDate,
        status: "CLOSED",
        currency: "ARS",
        openingBalance: dailyBal,
        openedAt: businessDate,
        closedAt: d(y, m, 28),
        openedById: userId,
        closedById: userId,
      },
    });

    await prisma.cashMovement.create({
      data: {
        organizationId: orgId,
        registerId: daily.id,
        sessionId: session.id,
        type: "OPENING",
        amount: dailyBal,
        balanceAfter: dailyBal,
        description: `Apertura ${sessionNumber}`,
        occurredAt: businessDate,
        createdById: userId,
      },
    });

    // 2–3 cobros del mes
    const activeProjects = projects.filter(
      (p) => p.status === "ACTIVE" || p.status === "COMPLETED",
    );
    const receiptsThisMonth = 2 + (m % 2);
    for (let i = 0; i < receiptsThisMonth; i++) {
      const p = activeProjects[(m + i) % activeProjects.length];
      const amount = money(800_000 + ((m * 17 + i * 41) % 50) * 25_000);
      const day = 8 + i * 7;
      const issueDate = d(y, m, Math.min(day, 27));
      const methods: PaymentMethod[] = ["TRANSFER", "CASH", "TRANSFER"];
      const method = methods[i % methods.length];
      const number = `REC-${y}-${pad(recN++)}`;
      const itemId = p.budgetItemIds[i % p.budgetItemIds.length];

      const receipt = await prisma.receipt.create({
        data: {
          organizationId: orgId,
          createdById: userId,
          clientId: p.clientId,
          number,
          issueDate,
          status: "POSTED",
          paymentMethod: method,
          concept: `Cobro avance ${p.code}`,
          currency: "ARS",
          totalAmount: amount,
          postedAt: issueDate,
          lines: {
            create: [
              {
                projectId: p.id,
                budgetItemId: itemId,
                description: `Imputación ${p.code}`,
                amount,
                sortOrder: 0,
              },
            ],
          },
          payments: {
            create: [
              {
                method,
                amount,
                bankAccountId: method === "TRANSFER" ? bankGalicia.id : null,
                sortOrder: 0,
              },
            ],
          },
        },
      });

      await prisma.budgetItem.update({
        where: { id: itemId },
        data: { actualIncome: { increment: amount } },
      });

      if (method === "CASH") {
        dailyBal = money(dailyBal + amount);
        await prisma.cashMovement.create({
          data: {
            organizationId: orgId,
            registerId: daily.id,
            sessionId: session.id,
            type: "INCOME",
            amount,
            balanceAfter: dailyBal,
            description: `Cobro ${number}`,
            occurredAt: issueDate,
            receiptId: receipt.id,
            createdById: userId,
          },
        });
        await prisma.cashRegister.update({
          where: { id: daily.id },
          data: { balance: dailyBal },
        });
      } else {
        balG = money(balG + amount);
        await prisma.bankMovement.create({
          data: {
            organizationId: orgId,
            bankAccountId: bankGalicia.id,
            type: "INCOME",
            amount,
            balanceAfter: balG,
            description: `Cobro ${number}`,
            occurredAt: issueDate,
            receiptId: receipt.id,
            createdById: userId,
          },
        });
        await prisma.bankAccount.update({
          where: { id: bankGalicia.id },
          data: { balance: balG },
        });
      }
    }

    // 3–4 pagos del mes
    const paymentsThisMonth = 3 + (m % 2);
    for (let i = 0; i < paymentsThisMonth; i++) {
      const p = activeProjects[(m + i + 1) % activeProjects.length];
      const supplier = suppliers[(m + i) % suppliers.length];
      const amount = money(250_000 + ((m * 13 + i * 29) % 40) * 12_000);
      const day = 10 + i * 5;
      const issueDate = d(y, m, Math.min(day, 26));
      let method: PaymentMethod = i % 3 === 0 ? "CASH" : "TRANSFER";
      if (method === "CASH" && dailyBal < amount) method = "TRANSFER";

      // Preferir Galicia; Nación solo si hay saldo suficiente (cuenta sueldos)
      let bankId = bankGalicia.id;
      if (method === "TRANSFER") {
        if (i % 4 === 1 && balN >= amount) bankId = bankNacion.id;
        else if (balG < amount && balN >= amount) bankId = bankNacion.id;
        else if (balG < amount && balN < amount) {
          // Skip pago si no hay fondos (mantiene saldos realistas)
          continue;
        }
      }

      const number = `OP-${y}-${pad(opN++)}`;
      const itemId = p.budgetItemIds[(i + 1) % p.budgetItemIds.length];

      const op = await prisma.paymentOrder.create({
        data: {
          organizationId: orgId,
          createdById: userId,
          supplierId: supplier.id,
          number,
          issueDate,
          status: "POSTED",
          paymentMethod: method,
          concept: `Pago materiales / servicios ${supplier.name}`,
          currency: "ARS",
          totalAmount: amount,
          postedAt: issueDate,
          lines: {
            create: [
              {
                projectId: p.id,
                budgetItemId: itemId,
                description: `Costo ${p.code} · ${supplier.name}`,
                amount,
                sortOrder: 0,
              },
            ],
          },
          payments: {
            create: [
              {
                method,
                amount,
                bankAccountId: method === "TRANSFER" ? bankId : null,
                sortOrder: 0,
              },
            ],
          },
        },
      });

      await prisma.budgetItem.update({
        where: { id: itemId },
        data: { actualCost: { increment: amount } },
      });

      if (method === "CASH") {
        dailyBal = money(dailyBal - amount);
        await prisma.cashMovement.create({
          data: {
            organizationId: orgId,
            registerId: daily.id,
            sessionId: session.id,
            type: "EXPENSE",
            amount: -amount,
            balanceAfter: dailyBal,
            description: `Pago ${number}`,
            occurredAt: issueDate,
            paymentOrderId: op.id,
            createdById: userId,
          },
        });
        await prisma.cashRegister.update({
          where: { id: daily.id },
          data: { balance: dailyBal },
        });
      } else if (bankId === bankGalicia.id) {
        balG = money(balG - amount);
        await prisma.bankAccount.update({
          where: { id: bankGalicia.id },
          data: { balance: balG },
        });
        await prisma.bankMovement.create({
          data: {
            organizationId: orgId,
            bankAccountId: bankGalicia.id,
            type: "EXPENSE",
            amount: -amount,
            balanceAfter: balG,
            description: `Pago ${number}`,
            occurredAt: issueDate,
            paymentOrderId: op.id,
            createdById: userId,
          },
        });
      } else {
        balN = money(balN - amount);
        await prisma.bankAccount.update({
          where: { id: bankNacion.id },
          data: { balance: balN },
        });
        await prisma.bankMovement.create({
          data: {
            organizationId: orgId,
            bankAccountId: bankNacion.id,
            type: "EXPENSE",
            amount: -amount,
            balanceAfter: balN,
            description: `Pago ${number}`,
            occurredAt: issueDate,
            paymentOrderId: op.id,
            createdById: userId,
          },
        });
      }
    }

    // Cierre de caja: transferir efectivo a tesorería
    const transfer = Math.max(0, money(dailyBal - 50_000));
    if (transfer > 0) {
      dailyBal = money(dailyBal - transfer);
      treasuryBal = money(treasuryBal + transfer);
      await prisma.cashMovement.create({
        data: {
          organizationId: orgId,
          registerId: daily.id,
          sessionId: session.id,
          type: "CLOSE_TRANSFER",
          amount: -transfer,
          balanceAfter: dailyBal,
          description: `Cierre → tesorería ${sessionNumber}`,
          occurredAt: d(y, m, 28),
          createdById: userId,
        },
      });
      await prisma.cashMovement.create({
        data: {
          organizationId: orgId,
          registerId: treasury.id,
          type: "TREASURY_IN",
          amount: transfer,
          balanceAfter: treasuryBal,
          description: `Ingreso cierre ${sessionNumber}`,
          occurredAt: d(y, m, 28),
          sourceSessionId: session.id,
          createdById: userId,
        },
      });
    }

    await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        expectedBalance: dailyBal,
        countedBalance: dailyBal,
        difference: 0,
        transferredAmount: transfer,
        status: "CLOSED",
      },
    });
    await prisma.cashRegister.update({
      where: { id: daily.id },
      data: { balance: dailyBal },
    });
    await prisma.cashRegister.update({
      where: { id: treasury.id },
      data: { balance: treasuryBal },
    });

    // Depósito ocasional tesorería → banco
    if (m % 3 === 0 && treasuryBal > 200_000) {
      const dep = money(100_000);
      treasuryBal = money(treasuryBal - dep);
      balG = money(balG + dep);
      await prisma.cashMovement.create({
        data: {
          organizationId: orgId,
          registerId: treasury.id,
          type: "BANK_DEPOSIT",
          amount: -dep,
          balanceAfter: treasuryBal,
          description: "Depósito tesorería → Galicia",
          occurredAt: d(y, m, 29),
          createdById: userId,
        },
      });
      await prisma.bankMovement.create({
        data: {
          organizationId: orgId,
          bankAccountId: bankGalicia.id,
          type: "DEPOSIT",
          amount: dep,
          balanceAfter: balG,
          description: "Depósito desde tesorería",
          occurredAt: d(y, m, 29),
          createdById: userId,
        },
      });
      await prisma.cashRegister.update({
        where: { id: treasury.id },
        data: { balance: treasuryBal },
      });
      await prisma.bankAccount.update({
        where: { id: bankGalicia.id },
        data: { balance: balG },
      });
    }
  }

  // Sesión de caja abierta hoy (operativa)
  const today = new Date();
  const openSession = await prisma.cashSession.create({
    data: {
      organizationId: orgId,
      registerId: daily.id,
      number: `CAJA-${today.getFullYear()}-${pad(cajaN++)}`,
      businessDate: d(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate(),
      ),
      status: "OPEN",
      currency: "ARS",
      openingBalance: dailyBal,
      openedById: userId,
    },
  });
  await prisma.cashMovement.create({
    data: {
      organizationId: orgId,
      registerId: daily.id,
      sessionId: openSession.id,
      type: "OPENING",
      amount: dailyBal,
      balanceAfter: dailyBal,
      description: "Apertura sesión vigente",
      createdById: userId,
    },
  });

  // —— Campo: partes diarios, punch list, documentos, compras, inventario ——
  const weatherCycle = ["CLEAR", "CLOUDY", "RAIN", "WIND", "CLEAR", "CLOUDY"] as const;
  const workers = [
    { workerName: "Juan Pérez", roleOrTrade: "Oficial albañil", companyName: "Cuadrilla propia" },
    { workerName: "Carlos Gómez", roleOrTrade: "Medio oficial", companyName: "Cuadrilla propia" },
    { workerName: "Luis Fernández", roleOrTrade: "Ayudante", companyName: "Cuadrilla propia" },
    { workerName: "Miguel Torres", roleOrTrade: "Armador", companyName: "Aceros del Paraná" },
    { workerName: "Roberto Díaz", roleOrTrade: "Electricista", companyName: "Electricidad Industrial Sur" },
  ];
  const equipmentPool = [
    { equipmentName: "Hormigonera 350 L", operatorName: "Juan Pérez" },
    { equipmentName: "Andamio tubular", operatorName: null },
    { equipmentName: "Retroexcavadora CAT 416", operatorName: "Operador externo" },
    { equipmentName: "Sierra circular", operatorName: "Carlos Gómez" },
  ];

  let dailyReportCount = 0;
  let punchCount = 0;
  let docCount = 0;
  let prCount = 0;
  let poCount = 0;
  let invInvoiceCount = 0;
  let inventoryCount = 0;

  const fieldProjects = projects.filter((p) => p.status !== "ON_HOLD");

  for (const p of fieldProjects) {
    // Partes diarios: ~1 por semana en los últimos ~4 meses (hasta ~16)
    const reportDates: Date[] = [];
    const startReports = new Date(Math.max(p.start.getTime(), d(2026, 3, 1).getTime()));
    for (let week = 0; week < 16; week++) {
      const rd = new Date(startReports);
      rd.setUTCDate(rd.getUTCDate() + week * 7);
      if (rd > today) break;
      if (p.status === "COMPLETED" && p.start) {
        // obras terminadas: partes más viejos
      }
      reportDates.push(
        d(rd.getUTCFullYear(), rd.getUTCMonth() + 1, rd.getUTCDate()),
      );
    }
    // Para completadas, tomar fechas dentro del período de obra
    const datesToUse =
      p.status === "COMPLETED"
        ? Array.from({ length: 10 }, (_, i) => {
            const base = new Date(p.start);
            base.setUTCDate(base.getUTCDate() + 20 + i * 14);
            return d(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
          })
        : reportDates.slice(0, 12);

    for (const [ri, reportDate] of datesToUse.entries()) {
      const weather = weatherCycle[ri % weatherCycle.length];
      const itemId = p.budgetItemIds[ri % p.budgetItemIds.length];
      await prisma.dailyReport.create({
        data: {
          projectId: p.id,
          authorId: userId,
          reportDate,
          weather,
          temperature: 12 + (ri % 18),
          notes: `Parte diario ${p.code} — jornada ${ri + 1}`,
          workforceNotes: "Personal completo en horario normal",
          advanceNotes: "Avance según plan semanal",
          syncedAt: reportDate,
          workforce: {
            create: workers.slice(0, 3 + (ri % 3)).map((w) => ({
              ...w,
              hoursWorked: 8,
            })),
          },
          equipment: {
            create: equipmentPool.slice(0, 1 + (ri % 3)).map((e) => ({
              equipmentName: e.equipmentName,
              operatorName: e.operatorName,
              hoursUsed: 4 + (ri % 5),
            })),
          },
          advances: {
            create: [
              {
                budgetItemId: itemId,
                description: `Avance ${p.code} partida`,
                quantity: money(2 + (ri % 5) * 1.5),
                unit: "m2",
                notes: "Medición de obra",
              },
            ],
          },
          incidents:
            ri % 5 === 4
              ? {
                  create: [
                    {
                      title: "Retraso por lluvia",
                      description: "Se detuvo hormigonado 2 hs",
                      severity: "MEDIUM" as const,
                    },
                  ],
                }
              : undefined,
        },
      });
      dailyReportCount++;
    }

    // Punch list
    const punches = [
      {
        title: "Fisura en revoque pared este",
        location: "PB · Eje B",
        status: "PENDING" as const,
        priority: "HIGH" as const,
      },
      {
        title: "Falta sellado de junta",
        location: "1° piso · baño",
        status: "IN_PROGRESS" as const,
        priority: "MEDIUM" as const,
      },
      {
        title: "Pintura irregular en cielo raso",
        location: "Hall acceso",
        status: "RESOLVED" as const,
        priority: "LOW" as const,
      },
      {
        title: "Protección de borde incompleta",
        location: "Azotea",
        status: "PENDING" as const,
        priority: "CRITICAL" as const,
      },
      {
        title: "Desnivel en solado",
        location: "Cochera",
        status: "IN_PROGRESS" as const,
        priority: "HIGH" as const,
      },
    ];
    for (const [pi, punch] of punches.entries()) {
      if (p.status === "COMPLETED" && punch.status === "PENDING" && pi > 1) continue;
      await prisma.punchListItem.create({
        data: {
          projectId: p.id,
          createdById: userId,
          assigneeId: userId,
          title: punch.title,
          description: `Observación de calidad en ${p.name}`,
          location: punch.location,
          status: punch.status,
          priority: punch.priority,
          dueDate: d(2026, 6 + (pi % 2), 15 + pi),
          resolvedAt: punch.status === "RESOLVED" ? d(2026, 5, 10 + pi) : null,
          syncedAt: d(2026, 5, 1),
        },
      });
      punchCount++;
    }

    // Documentos
    const docs = [
      { title: "Plano de arquitectura — planta tipo", type: "PLAN" as const, category: "Arquitectura", file: "planta-tipo-v2.pdf" },
      { title: "Plano estructural — fundaciones", type: "PLAN" as const, category: "Estructural", file: "fundaciones-v1.pdf" },
      { title: "Especificación técnica instalaciones", type: "SPEC" as const, category: "MEP", file: "espec-mep.pdf" },
      { title: "Contrato de obra", type: "CONTRACT" as const, category: "Legal", file: "contrato-obra.pdf" },
      { title: "Informe de avance mensual", type: "REPORT" as const, category: "Reportes", file: "avance-mensual.pdf" },
      { title: "Foto avance estructura", type: "PHOTO" as const, category: "Obra", file: "avance-estructura.jpg" },
    ];
    for (const [di, doc] of docs.entries()) {
      await prisma.document.create({
        data: {
          projectId: p.id,
          uploadedById: userId,
          title: doc.title,
          description: `${doc.title} — ${p.code}`,
          type: doc.type,
          category: doc.category,
          currentVersion: di % 3 === 0 ? 2 : 1,
          versions: {
            create: [
              {
                version: 1,
                fileName: doc.file,
                fileUrl: `/uploads/seed/${p.code}/${doc.file}`,
                fileSize: 250_000 + di * 40_000,
                mimeType: doc.type === "PHOTO" ? "image/jpeg" : "application/pdf",
                changeNotes: "Versión inicial",
              },
              ...(di % 3 === 0
                ? [
                    {
                      version: 2,
                      fileName: doc.file.replace(".", "-revA."),
                      fileUrl: `/uploads/seed/${p.code}/revA-${doc.file}`,
                      fileSize: 280_000 + di * 40_000,
                      mimeType: doc.type === "PHOTO" ? "image/jpeg" : "application/pdf",
                      changeNotes: "Revisión A — ajustes de proyecto",
                    },
                  ]
                : []),
            ],
          },
        },
      });
      docCount++;
    }

    // Inventario base
    const inventoryDefs = [
      { sku: "H-H21", name: "Hormigón H-21", category: "Hormigón", unit: "m3", qty: 45, min: 10, cost: 95_000, loc: "Planta / obra" },
      { sku: "AC-12", name: "Hierro ø12", category: "Hierros", unit: "kg", qty: 3200, min: 500, cost: 1_850, loc: "Depósito obra" },
      { sku: "AC-8", name: "Hierro ø8", category: "Hierros", unit: "kg", qty: 1800, min: 300, cost: 1_750, loc: "Depósito obra" },
      { sku: "CEM-50", name: "Cemento bolsa 50 kg", category: "Cemento", unit: "bolsa", qty: 220, min: 40, cost: 8_500, loc: "Galpón" },
      { sku: "LAD-COM", name: "Ladrillo común", category: "Mampostería", unit: "u", qty: 8500, min: 1000, cost: 180, loc: "Acopio" },
      { sku: "CAB-2.5", name: "Cable 2.5 mm²", category: "Eléctrico", unit: "m", qty: 450, min: 100, cost: 950, loc: "Obrador" },
      { sku: "PIN-LAT", name: "Pintura látex interior", category: "Pintura", unit: "L", qty: 80, min: 20, cost: 4_200, loc: "Obrador" },
      { sku: "AND-MOD", name: "Módulo andamio", category: "Equipos", unit: "u", qty: 24, min: 6, cost: 35_000, loc: "Patio" },
    ];
    const invItems: { id: string; name: string }[] = [];
    for (const [ii, inv] of inventoryDefs.entries()) {
      const item = await prisma.inventoryItem.create({
        data: {
          projectId: p.id,
          budgetItemId: p.budgetItemIds[ii % p.budgetItemIds.length],
          sku: `${p.code}-${inv.sku}`,
          name: inv.name,
          category: inv.category,
          unit: inv.unit,
          quantityOnHand: inv.qty,
          minQuantity: inv.min,
          unitCost: inv.cost,
          location: inv.loc,
          movements: {
            create: [
              {
                type: "IN",
                quantity: inv.qty + 40,
                reference: `ING-${p.code}-${pad(ii + 1, 2)}`,
                notes: "Ingreso inicial / compra",
                occurredAt: d(2026, 3, 5 + ii),
              },
              {
                type: "OUT",
                quantity: 40,
                reference: `CONS-${p.code}-${pad(ii + 1, 2)}`,
                notes: "Consumo en obra",
                occurredAt: d(2026, 4, 10 + ii),
              },
            ],
          },
        },
      });
      invItems.push(item);
      inventoryCount++;
    }

    // Compras: solicitud → cotizaciones → OC → factura
    const materials = [
      { description: "Hierro ø12", quantity: 1500, unit: "kg", unitCost: 1850 },
      { description: "Cemento bolsa 50 kg", quantity: 100, unit: "bolsa", unitCost: 8500 },
      { description: "Arena gruesa", quantity: 30, unit: "m3", unitCost: 22000 },
    ];
    const supplierA = p.supplierIds[0] ?? suppliers[0].id;
    const supplierB = p.supplierIds[1] ?? suppliers[1].id;

    for (let cycle = 0; cycle < 2; cycle++) {
      const prNumber = `SC-${p.code}-${pad(cycle + 1, 2)}`;
      const neededBy = d(2026, 4 + cycle, 20);
      const pr = await prisma.purchaseRequest.create({
        data: {
          projectId: p.id,
          createdById: userId,
          number: prNumber,
          title: `Pedido materiales ${cycle === 0 ? "estructura" : "terminaciones"}`,
          status: "ORDERED",
          neededBy,
          notes: "Solicitud generada desde obra",
          items: {
            create: materials.map((m) => ({
              description: m.description,
              quantity: m.quantity * (cycle + 1),
              unit: m.unit,
              estimatedUnitCost: m.unitCost,
            })),
          },
        },
        include: { items: true },
      });
      prCount++;

      const quoteATotal = money(
        pr.items.reduce(
          (s, it) => s + Number(it.quantity) * Number(it.estimatedUnitCost ?? 0) * 0.98,
          0,
        ),
      );
      const quoteBTotal = money(quoteATotal * 1.06);

      await prisma.supplierQuote.create({
        data: {
          purchaseRequestId: pr.id,
          supplierId: supplierA,
          validUntil: d(2026, 4 + cycle, 25),
          totalAmount: quoteATotal,
          isSelected: true,
          notes: "Mejor precio / plazo 7 días",
          items: {
            create: pr.items.map((it) => {
              const unitCost = money(Number(it.estimatedUnitCost ?? 0) * 0.98);
              const qty = Number(it.quantity);
              return {
                purchaseRequestItemId: it.id,
                description: it.description,
                quantity: qty,
                unitCost,
                totalCost: money(unitCost * qty),
                leadTimeDays: 7,
              };
            }),
          },
        },
      });
      await prisma.supplierQuote.create({
        data: {
          purchaseRequestId: pr.id,
          supplierId: supplierB,
          validUntil: d(2026, 4 + cycle, 22),
          totalAmount: quoteBTotal,
          isSelected: false,
          notes: "Alternativa",
          items: {
            create: pr.items.map((it) => {
              const unitCost = money(Number(it.estimatedUnitCost ?? 0) * 1.04);
              const qty = Number(it.quantity);
              return {
                purchaseRequestItemId: it.id,
                description: it.description,
                quantity: qty,
                unitCost,
                totalCost: money(unitCost * qty),
                leadTimeDays: 10,
              };
            }),
          },
        },
      });

      const subtotal = quoteATotal;
      const taxAmount = money(subtotal * 0.21);
      const totalAmount = money(subtotal + taxAmount);
      const poNumber = `OC-${p.code}-${pad(cycle + 1, 2)}`;
      const orderedAt = d(2026, 4 + cycle, 12);
      const received =
        cycle === 0 || p.status === "COMPLETED"
          ? ("RECEIVED" as const)
          : ("PARTIALLY_RECEIVED" as const);

      await prisma.purchaseOrder.create({
        data: {
          projectId: p.id,
          supplierId: supplierA,
          purchaseRequestId: pr.id,
          number: poNumber,
          status: received,
          orderedAt,
          expectedAt: d(2026, 4 + cycle, 20),
          receivedAt: received === "RECEIVED" ? d(2026, 4 + cycle, 18) : null,
          subtotal,
          taxAmount,
          totalAmount,
          notes: `OC vinculada a ${prNumber}`,
          items: {
            create: pr.items.map((it) => {
              const unitCost = money(Number(it.estimatedUnitCost ?? 0) * 0.98);
              const qty = Number(it.quantity);
              return {
                purchaseRequestItemId: it.id,
                description: it.description,
                quantity: qty,
                unit: it.unit,
                unitCost,
                totalCost: money(unitCost * qty),
                quantityReceived:
                  received === "RECEIVED" ? qty : money(qty * 0.6),
              };
            }),
          },
        },
      });
      poCount++;

      // Factura de compra confirmada
      const invNumber = `0001-${pad(1000 + invInvoiceCount + 1, 8)}`;
      const netAmount = subtotal;
      const invTax = taxAmount;
      const invTotal = totalAmount;
      const linkedInv = invItems[cycle % invItems.length];
      await prisma.purchaseInvoice.create({
        data: {
          projectId: p.id,
          supplierId: supplierA,
          number: invNumber,
          invoiceType: "A",
          pointOfSale: "0001",
          status: "CONFIRMED",
          issueDate: d(2026, 4 + cycle, 19),
          dueDate: d(2026, 5 + cycle, 19),
          currency: "ARS",
          netAmount,
          taxAmount: invTax,
          totalAmount: invTotal,
          paidAmount: cycle === 0 ? invTotal : money(invTotal * 0.5),
          supplierName: suppliers.find((s) => s.id === supplierA)?.name,
          fileUrl: `/uploads/seed/${p.code}/factura-${invNumber}.pdf`,
          fileName: `factura-${invNumber}.pdf`,
          mimeType: "application/pdf",
          fileSize: 120_000,
          notes: "Factura asociada a OC",
          items: {
            create: pr.items.map((it, idx) => {
              const unitCost = money(Number(it.estimatedUnitCost ?? 0) * 0.98);
              const qty = Number(it.quantity);
              const lineNet = money(unitCost * qty);
              return {
                description: it.description,
                quantity: qty,
                unit: it.unit,
                unitCost,
                taxPct: 21,
                totalCost: money(lineNet * 1.21),
                category: idx === 0 ? "Hierros" : "Cemento",
                sortOrder: idx,
                inventoryItemId: idx === 0 ? linkedInv.id : null,
              };
            }),
          },
        },
      });
      invInvoiceCount++;
    }

    // Una solicitud en borrador pendiente
    await prisma.purchaseRequest.create({
      data: {
        projectId: p.id,
        createdById: userId,
        number: `SC-${p.code}-99`,
        title: "Pedido pendiente de aprobación",
        status: "SUBMITTED",
        neededBy: d(2026, 8, 15),
        notes: "Requiere cotización",
        items: {
          create: [
            {
              description: "Pintura látex interior",
              quantity: 40,
              unit: "L",
              estimatedUnitCost: 4200,
            },
            {
              description: "Rodillo + bandeja",
              quantity: 10,
              unit: "kit",
              estimatedUnitCost: 3500,
            },
          ],
        },
      },
    });
    prCount++;
  }

  const [cCount, sCount, pCount, rCount, oCount, bCount, sessCount] =
    await Promise.all([
      prisma.client.count({ where: { organizationId: orgId } }),
      prisma.supplier.count({ where: { organizationId: orgId } }),
      prisma.project.count({ where: { organizationId: orgId } }),
      prisma.receipt.count({ where: { organizationId: orgId } }),
      prisma.paymentOrder.count({ where: { organizationId: orgId } }),
      prisma.bankAccount.count({ where: { organizationId: orgId } }),
      prisma.cashSession.count({ where: { organizationId: orgId } }),
    ]);

  console.log("✅ Seed Empresa de Test OK");
  console.log(`   Clientes: ${cCount}`);
  console.log(`   Proveedores: ${sCount}`);
  console.log(`   Obras: ${pCount}`);
  console.log(`   Recibos: ${rCount}`);
  console.log(`   Órdenes de pago: ${oCount}`);
  console.log(`   Bancos: ${bCount} (Galicia ${balG}, Nación ${balN})`);
  console.log(
    `   Cajas: diaria ${dailyBal} / tesorería ${treasuryBal} · sesiones ${sessCount}`,
  );
  console.log(`   Sesión abierta: ${openSession.number}`);
  console.log(`   Partes diarios: ${dailyReportCount}`);
  console.log(`   Punch list: ${punchCount}`);
  console.log(`   Documentos: ${docCount}`);
  console.log(`   Solicitudes de compra: ${prCount}`);
  console.log(`   Órdenes de compra: ${poCount}`);
  console.log(`   Facturas de compra: ${invInvoiceCount}`);
  console.log(`   Ítems inventario: ${inventoryCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
