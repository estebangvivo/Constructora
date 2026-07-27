/**
 * Origen público detrás de Railway/Cloudflare.
 * `request.url` en producción puede ser https://0.0.0.0:PORT/... y romper redirects.
 */
export function publicOrigin(request: Request): string {
  const xfHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();
  const host = xfHost || hostHeader;

  const isInternal =
    !host ||
    host.startsWith("0.0.0.0") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::]");

  if (host && !isInternal) {
    const xfProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const proto =
      xfProto ||
      (host.includes("localhost") || host.startsWith("192.168.")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const railway =
    process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ||
    process.env.RAILWAY_STATIC_URL?.trim();
  if (railway) {
    return railway.startsWith("http") ? railway.replace(/\/$/, "") : `https://${railway}`;
  }

  try {
    const url = new URL(request.url);
    if (url.hostname && url.hostname !== "0.0.0.0") {
      return url.origin;
    }
  } catch {
    /* ignore */
  }

  return "http://localhost:3000";
}

export function publicUrl(request: Request, path: string): URL {
  const base = publicOrigin(request);
  return new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`);
}
