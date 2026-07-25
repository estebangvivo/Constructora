"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { formatCuit, digitsOnly } from "@/lib/arca/tax-id";
import { COLOR_PALETTES, DEFAULT_THEME_ID } from "@/config/themes";
import {
  normalizeCurrency,
  normalizeEnabledCurrencies,
  parseEnabledCurrenciesField,
} from "@/config/currencies";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR"].includes(role);
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

async function saveLogoFile(
  organizationId: string,
  file: File,
): Promise<string> {
  if (!LOGO_TYPES.has(file.type)) {
    throw new Error("El logo debe ser PNG, JPG, WEBP o SVG.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("El logo no puede superar 2 MB.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/svg+xml"
          ? "svg"
          : "jpg";

  const dir = path.join(process.cwd(), "public", "uploads", "logos");
  await mkdir(dir, { recursive: true });

  const filename = `${organizationId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return `/uploads/logos/${filename}?v=${Date.now()}`;
}

export async function updateOrganizationProfile(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return {
        ok: false,
        error: "No tienes permiso para editar la constructora.",
      };
    }

    const name = emptyToNull(formData.get("name"));
    if (!name) {
      return { ok: false, error: "El nombre comercial es obligatorio." };
    }

    const logoFile = formData.get("logo");
    let logoUrl: string | undefined;
    if (logoFile instanceof File && logoFile.size > 0) {
      logoUrl = await saveLogoFile(session.organizationId, logoFile);
    }

    const clearLogo = formData.get("clearLogo") === "1";

    const rawTaxId = emptyToNull(formData.get("taxId"));
    const taxId = rawTaxId
      ? digitsOnly(rawTaxId).length === 11
        ? formatCuit(rawTaxId)
        : rawTaxId
      : null;

    const requestedTheme = emptyToNull(formData.get("themeId")) ?? DEFAULT_THEME_ID;
    const themeId = COLOR_PALETTES.some((p) => p.id === requestedTheme)
      ? requestedTheme
      : DEFAULT_THEME_ID;

    const currency = normalizeCurrency(emptyToNull(formData.get("currency")));
    const enabledCurrencies = normalizeEnabledCurrencies(
      parseEnabledCurrenciesField(formData.get("enabledCurrencies")),
      currency,
    );

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        name,
        legalName: emptyToNull(formData.get("legalName")),
        taxId,
        email: emptyToNull(formData.get("email")),
        phone: emptyToNull(formData.get("phone")),
        address: emptyToNull(formData.get("address")),
        city: emptyToNull(formData.get("city")),
        province: emptyToNull(formData.get("province")),
        postalCode: emptyToNull(formData.get("postalCode")),
        country: emptyToNull(formData.get("country")) ?? "AR",
        website: emptyToNull(formData.get("website")),
        facebookUrl: emptyToNull(formData.get("facebookUrl")),
        instagramUrl: emptyToNull(formData.get("instagramUrl")),
        linkedinUrl: emptyToNull(formData.get("linkedinUrl")),
        xUrl: emptyToNull(formData.get("xUrl")),
        whatsapp: emptyToNull(formData.get("whatsapp")),
        themeId,
        currency,
        enabledCurrencies,
        ...(logoUrl ? { logoUrl } : clearLogo ? { logoUrl: null } : {}),
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    console.error("updateOrganizationProfile", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración.",
    };
  }
}
