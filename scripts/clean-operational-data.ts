/**
 * Limpia datos operativos / de prueba y conserva la configuración:
 * - Organization (perfil, tema, monedas, logo)
 * - Users + OrganizationMember
 * - ExchangeRate
 * - CashRegister (cajas, con saldo en 0)
 *
 * Uso: npx tsx scripts/clean-operational-data.ts
 */
import { PrismaClient } from "@prisma/client";
import { rm } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function wipeUploadDirs() {
  const root = path.join(process.cwd(), "public", "uploads");
  for (const folder of ["documents", "invoices"]) {
    const dir = path.join(root, folder);
    try {
      await rm(dir, { recursive: true, force: true });
      console.log(`  uploads/${folder} eliminado`);
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log("🧹 Limpiando datos operativos (se conserva configuración)…\n");

  // Orden: hijos / documentos operativos primero, luego catálogos.
  const steps: { label: string; run: () => Promise<unknown> }[] = [
    {
      label: "Movimientos de caja",
      run: () => prisma.cashMovement.deleteMany(),
    },
    {
      label: "Sesiones de caja",
      run: () => prisma.cashSession.deleteMany(),
    },
    {
      label: "Líneas de recibos / OP",
      run: async () => {
        await prisma.receiptLine.deleteMany();
        await prisma.paymentOrderLine.deleteMany();
      },
    },
    {
      label: "Recibos y órdenes de pago",
      run: async () => {
        await prisma.receipt.deleteMany();
        await prisma.paymentOrder.deleteMany();
      },
    },
    {
      label: "Movimientos e ítems de inventario",
      run: async () => {
        await prisma.inventoryMovement.deleteMany();
        await prisma.inventoryItem.deleteMany();
      },
    },
    {
      label: "Facturas de compra",
      run: async () => {
        await prisma.purchaseInvoiceItem.deleteMany();
        await prisma.purchaseInvoice.deleteMany();
      },
    },
    {
      label: "Órdenes / solicitudes de compra",
      run: async () => {
        await prisma.purchaseOrderItem.deleteMany();
        await prisma.supplierQuoteItem.deleteMany();
        await prisma.supplierQuote.deleteMany();
        await prisma.purchaseOrder.deleteMany();
        await prisma.purchaseRequestItem.deleteMany();
        await prisma.purchaseRequest.deleteMany();
      },
    },
    {
      label: "Certificaciones",
      run: async () => {
        await prisma.certificationItem.deleteMany();
        await prisma.certification.deleteMany();
      },
    },
    {
      label: "Órdenes de cambio",
      run: async () => {
        await prisma.changeOrderItem.deleteMany();
        await prisma.changeOrder.deleteMany();
      },
    },
    {
      label: "Presupuestos",
      run: async () => {
        await prisma.budgetItem.deleteMany();
        await prisma.budget.deleteMany();
      },
    },
    {
      label: "Cronograma",
      run: async () => {
        await prisma.task.deleteMany();
        await prisma.milestone.deleteMany();
      },
    },
    {
      label: "Parte diario",
      run: async () => {
        await prisma.dailyReportWorkforce.deleteMany();
        await prisma.dailyReportEquipment.deleteMany();
        await prisma.dailyReportAdvance.deleteMany();
        await prisma.dailyReportIncident.deleteMany();
        await prisma.dailyReport.deleteMany();
      },
    },
    {
      label: "Punch list",
      run: () => prisma.punchListItem.deleteMany(),
    },
    {
      label: "Documentos",
      run: async () => {
        await prisma.documentVersion.deleteMany();
        await prisma.document.deleteMany();
      },
    },
    {
      label: "Subcontratas en obra",
      run: async () => {
        await prisma.contractorDocument.deleteMany();
        await prisma.projectContractor.deleteMany();
      },
    },
    {
      label: "Proveedores en obra + membresías de obra",
      run: async () => {
        await prisma.projectSupplier.deleteMany();
        await prisma.projectMembership.deleteMany();
      },
    },
    {
      label: "Obras",
      run: () => prisma.project.deleteMany(),
    },
    {
      label: "Catálogo clientes / proveedores / contratistas",
      run: async () => {
        await prisma.client.deleteMany();
        await prisma.supplier.deleteMany();
        await prisma.contractor.deleteMany();
      },
    },
    {
      label: "Reset saldo cajas (configuración)",
      run: () =>
        prisma.cashRegister.updateMany({
          data: { balance: 0 },
        }),
    },
  ];

  for (const step of steps) {
    await step.run();
    console.log(`✓ ${step.label}`);
  }

  console.log("\n🗂  Limpiando archivos subidos (documentos / facturas)…");
  await wipeUploadDirs();

  const [orgs, users, rates, registers] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.exchangeRate.count(),
    prisma.cashRegister.count(),
  ]);

  console.log("\n✅ Listo. Conservado:");
  console.log(`   Organizaciones: ${orgs}`);
  console.log(`   Usuarios:       ${users}`);
  console.log(`   Tipos de cambio: ${rates}`);
  console.log(`   Cajas (registro): ${registers}`);
  console.log("\nEl sistema quedó sin obras ni datos de prueba.");
}

main()
  .catch((error) => {
    console.error("Error al limpiar:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
