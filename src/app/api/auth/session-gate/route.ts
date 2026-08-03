import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  verifyLocalSession,
} from "@/features/auth/lib/session-crypto";
import { isPlatformSuperadminEmail } from "@/features/auth/lib/platform-admin";

export const dynamic = "force-dynamic";

function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/**
 * Valida que el JWT local coincida con sessionVersion actual del usuario.
 * Usado por el middleware (ruta pública para evitar deadlock).
 */
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`),
  );
  const token = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (!token) {
    return clearSessionCookie(
      NextResponse.json({ ok: false }, { status: 401 }),
    );
  }

  const local = await verifyLocalSession(token);
  if (!local) {
    return clearSessionCookie(
      NextResponse.json({ ok: false }, { status: 401 }),
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: local.userId, isActive: true },
    select: { email: true, sessionVersion: true },
  });
  if (!user) {
    return clearSessionCookie(
      NextResponse.json({ ok: false }, { status: 401 }),
    );
  }

  if (
    !isPlatformSuperadminEmail(user.email) &&
    local.sessionVersion !== (user.sessionVersion ?? 0)
  ) {
    return clearSessionCookie(
      NextResponse.json(
        { ok: false, reason: "session_replaced" },
        { status: 401 },
      ),
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
