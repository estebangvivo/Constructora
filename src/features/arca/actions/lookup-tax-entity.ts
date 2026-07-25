"use server";

import {
  getTaxLookupProviders,
  isArcaConfigured,
  lookupArcaTaxId,
} from "@/lib/arca/lookup";
import type { ArcaLookupResult } from "@/lib/arca/types";
import { requireSession } from "@/lib/auth";

export async function lookupTaxEntityAction(
  taxId: string,
): Promise<ArcaLookupResult> {
  await requireSession();
  return lookupArcaTaxId(taxId);
}

export async function getArcaStatusAction(): Promise<{
  configured: boolean;
  providers: { indicadores: boolean; afipsdk: boolean };
}> {
  await requireSession();
  return {
    configured: isArcaConfigured(),
    providers: getTaxLookupProviders(),
  };
}
