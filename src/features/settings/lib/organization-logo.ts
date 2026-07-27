import { readFile } from "node:fs/promises";
import path from "node:path";

export type OrganizationLogoBytes = {
  bytes: Uint8Array;
  format: "png" | "jpg";
};

/**
 * Carga bytes del logo para PDF.
 * Soporta data URLs (persistente en Railway) y rutas /uploads/… (dev local).
 */
export async function loadOrganizationLogoBytes(
  logoUrl: string | null | undefined,
): Promise<OrganizationLogoBytes | null> {
  if (!logoUrl) return null;

  if (logoUrl.startsWith("data:")) {
    const match = /^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i.exec(
      logoUrl.split("?")[0] ?? logoUrl,
    );
    if (!match) return null;
    const mime = match[1].toLowerCase();
    const format: "png" | "jpg" =
      mime === "image/png" ? "png" : "jpg";
    try {
      const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
      return { bytes, format };
    } catch {
      return null;
    }
  }

  const pathname = logoUrl.split("?")[0] ?? "";
  if (!pathname.startsWith("/uploads/")) return null;

  const ext = path.extname(pathname).toLowerCase();
  const format =
    ext === ".png" ? "png" : ext === ".jpg" || ext === ".jpeg" ? "jpg" : null;
  if (!format) return null;

  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      pathname.replace(/^\//, ""),
    );
    const bytes = new Uint8Array(await readFile(filePath));
    return { bytes, format };
  } catch {
    return null;
  }
}

/** true si la URL del logo puede mostrarse en <img> de forma fiable. */
export function isDisplayableLogoUrl(logoUrl: string | null | undefined): boolean {
  if (!logoUrl) return false;
  if (logoUrl.startsWith("data:image/")) return true;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return true;
  }
  // /uploads/ en producción no persiste en Railway
  if (logoUrl.startsWith("/uploads/")) {
    return process.env.NODE_ENV !== "production";
  }
  return false;
}

/**
 * src para <img>. Los data URL se exponen por API para no inflar el HTML
 * y para que el navegador cachee el binario.
 */
export function organizationLogoSrc(
  logoUrl: string | null | undefined,
): string | null {
  if (!isDisplayableLogoUrl(logoUrl)) return null;
  if (logoUrl!.startsWith("data:image/")) {
    // cache-bust por longitud (cambia al re-subir)
    return `/api/organization/logo?v=${logoUrl!.length}`;
  }
  return logoUrl!;
}
