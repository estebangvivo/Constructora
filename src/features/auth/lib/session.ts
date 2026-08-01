import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  signLocalSession,
  verifyLocalSession,
  type LocalSessionPayload,
} from "@/features/auth/lib/session-crypto";

export {
  SESSION_COOKIE,
  signLocalSession,
  verifyLocalSession,
  type LocalSessionPayload,
};

export async function setLocalSessionCookie(token: string) {
  const jar = await cookies();
  // En HTTP (LAN / tablet) Secure=true impide guardar la cookie.
  const secure =
    process.env.NODE_ENV === "production" &&
    process.env.FORCE_INSECURE_COOKIES !== "true";
  // Sin maxAge = cookie de sesión: al cerrar el navegador hay que volver a loguearse.
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });
}

export async function clearLocalSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readLocalSessionFromCookies(): Promise<LocalSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyLocalSession(token);
}
