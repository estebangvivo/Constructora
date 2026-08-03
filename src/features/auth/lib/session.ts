import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isPlatformSuperadminEmail } from "@/features/auth/lib/platform-admin";
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

/**
 * Emite JWT de sesión.
 * - bumpSession: true en login/registro → invalida otras sesiones (no superadmin).
 * - bumpSession: false al cambiar org / renovar cookie → mantiene la misma versión.
 */
export async function issueLocalSessionToken(input: {
  userId: string;
  organizationId: string | null;
  /** Si true, cierra otras sesiones del usuario (excepto superadmin). */
  bumpSession?: boolean;
}): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, sessionVersion: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new Error("Usuario no encontrado o inactivo.");
  }

  const isSuperadmin = isPlatformSuperadminEmail(user.email);
  let sessionVersion = user.sessionVersion ?? 0;

  if (input.bumpSession && !isSuperadmin) {
    const updated = await prisma.user.update({
      where: { id: input.userId },
      data: {
        sessionVersion: { increment: 1 },
        lastSeenAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: { sessionVersion: true },
    });
    sessionVersion = updated.sessionVersion;
  } else if (input.bumpSession && isSuperadmin) {
    try {
      await prisma.user.update({
        where: { id: input.userId },
        data: { lastSeenAt: new Date(), lastActivityAt: new Date() },
      });
    } catch (error) {
      console.warn("issueLocalSessionToken touch activity", error);
    }
  }

  return signLocalSession({
    userId: input.userId,
    organizationId: input.organizationId,
    sessionVersion,
  });
}
