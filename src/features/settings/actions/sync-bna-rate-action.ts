"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { syncBnaUsdRateForAllOrgs } from "@/features/settings/lib/sync-bna-rate";

export type ActionResult =
  | {
      ok: true;
      rate: number;
      buy: number;
      sell: number;
      effectiveAt: string;
      created: boolean;
    }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR"].includes(role);
}

/** Descarga cotización BNA y guarda el registro del día (histórico). */
export async function syncBnaExchangeRateAction(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const results = await syncBnaUsdRateForAllOrgs();
    const mine = results.find((r) => r.organizationId === session.organizationId);
    if (!mine) {
      return { ok: false, error: "No se pudo sincronizar la cotización." };
    }

    revalidatePath("/settings");
    revalidatePath("/treasury");
    revalidatePath("/projects");

    return {
      ok: true,
      rate: mine.rate,
      buy: mine.buy,
      sell: mine.sell,
      effectiveAt: mine.effectiveAt,
      created: mine.created,
    };
  } catch (error) {
    console.error("syncBnaExchangeRateAction", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo obtener la cotización del Banco Nación.",
    };
  }
}
