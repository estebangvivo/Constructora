"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { normalizeCurrency } from "@/config/currencies";

export type ActionResult = { ok: true } | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR"].includes(role);
}

export async function upsertExchangeRate(input: {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveAt: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const fromCurrency = normalizeCurrency(input.fromCurrency);
    const toCurrency = normalizeCurrency(input.toCurrency);
    if (fromCurrency === toCurrency) {
      return { ok: false, error: "Las monedas deben ser distintas." };
    }

    const rate = Number(input.rate);
    if (!(rate > 0) || Number.isNaN(rate)) {
      return { ok: false, error: "El tipo de cambio debe ser mayor a 0." };
    }

    const effectiveAt = new Date(input.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) {
      return { ok: false, error: "Fecha inválida." };
    }

    await prisma.exchangeRate.upsert({
      where: {
        organizationId_fromCurrency_toCurrency_effectiveAt: {
          organizationId: session.organizationId,
          fromCurrency,
          toCurrency,
          effectiveAt,
        },
      },
      create: {
        organizationId: session.organizationId,
        fromCurrency,
        toCurrency,
        rate,
        effectiveAt,
        notes: input.notes?.trim() || null,
      },
      update: {
        rate,
        notes: input.notes?.trim() || null,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/treasury");
    revalidatePath("/projects");
    return { ok: true };
  } catch (error) {
    console.error("upsertExchangeRate", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el tipo de cambio.",
    };
  }
}
