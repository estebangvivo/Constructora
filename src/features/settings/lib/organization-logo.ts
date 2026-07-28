/** Helpers de logo seguros para client components (sin node:fs). */

/** true si la URL del logo puede mostrarse en <img> de forma fiable. */
export function isDisplayableLogoUrl(
  logoUrl: string | null | undefined,
): boolean {
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
