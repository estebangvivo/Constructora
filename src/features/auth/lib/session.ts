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
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
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
