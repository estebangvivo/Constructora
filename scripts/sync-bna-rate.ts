/**
 * Sincroniza cotización USD BNA → ARS (registro diario histórico).
 * Uso: npm run fx:sync-bna
 */
import { syncBnaUsdRateForAllOrgs } from "../src/features/settings/lib/sync-bna-rate";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("↻ Sincronizando cotización BNA (USD→ARS)…");
  const results = await syncBnaUsdRateForAllOrgs();
  for (const r of results) {
    console.log(
      `  ${r.organizationName}: 1 USD = ${r.rate} ARS (${r.effectiveAt}) [${r.created ? "nuevo" : "actualizado"}] · ${r.source}`,
    );
  }
  console.log(`✅ ${results.length} organización(es)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
