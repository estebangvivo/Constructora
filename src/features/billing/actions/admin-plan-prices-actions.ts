"use server";

import { revalidatePath } from "next/cache";
import { requireAuthSession } from "@/lib/auth";
import { requirePlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import {
  getAdminPlanPricesEditor,
  upsertPlanPrices,
  type PlanPricesMap,
} from "@/features/billing/lib/effective-plans";
import type { BillingPlanId } from "@/features/billing/lib/plans";

export type AdminPlanPriceRow = Awaited<
  ReturnType<typeof getAdminPlanPricesEditor>
>[number];

export async function getAdminPlanPrices(): Promise<AdminPlanPriceRow[] | null> {
  try {
    const session = await requireAuthSession();
    requirePlatformSuperadmin(session);
    return getAdminPlanPricesEditor();
  } catch {
    return null;
  }
}

export async function saveAdminPlanPrices(input: {
  prices: Array<{
    id: string;
    priceUsd: number;
    priceArs: number | null;
  }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuthSession();
    requirePlatformSuperadmin(session);

    const map: PlanPricesMap = {};
    for (const row of input.prices) {
      if (!row.id) continue;
      if (!Number.isFinite(row.priceUsd) || row.priceUsd < 0) {
        return { ok: false, error: `Precio USD inválido en ${row.id}.` };
      }
      if (
        row.priceArs != null &&
        (!Number.isFinite(row.priceArs) || row.priceArs < 0)
      ) {
        return { ok: false, error: `Precio ARS inválido en ${row.id}.` };
      }
      map[row.id as BillingPlanId] = {
        priceUsd: row.priceUsd,
        priceArs: row.priceArs,
      };
    }

    await upsertPlanPrices({
      prices: map,
      updatedByUserId: session.user.id,
    });

    revalidatePath("/admin");
    revalidatePath("/billing");
    revalidatePath("/onboarding/planes");
    revalidatePath("/onboarding/pago");
    return { ok: true };
  } catch (error) {
    console.error("saveAdminPlanPrices", error);
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return { ok: false, error: "Sin permiso de superadmin." };
    }
    return {
      ok: false,
      error:
        "No se pudieron guardar los precios. ¿Corriste prisma db push (campo planPrices)?",
    };
  }
}
