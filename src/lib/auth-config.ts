export const DEV_USER_AUTH_ID = "dev_user_constructora";
export const DEV_ORG_SLUG = "demo-constructora";

/** Clerk listo para usarse (publishable en cliente; ambas en servidor). */
export function isClerkConfigured(): boolean {
  const publishable = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );

  if (typeof window !== "undefined") {
    return publishable;
  }

  return publishable && Boolean(process.env.CLERK_SECRET_KEY?.trim());
}

/**
 * Bypass local sin login (usuario seed).
 * Solo si AUTH_DEV_BYPASS=true explícito. Nunca en production.
 * Sin Clerk y sin bypass → login local (email/contraseña).
 */
export function isDevAuthBypass(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.AUTH_DEV_BYPASS === "true";
}
