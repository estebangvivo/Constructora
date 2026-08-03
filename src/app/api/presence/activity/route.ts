import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/features/auth/lib/session-crypto";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

function unauthorized() {
  const res = NextResponse.json({ error: "No autorizado" }, { status: 401 });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/** Registra interacción del usuario (anti-idle). */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return unauthorized();
  }

  try {
    await prisma.$executeRaw`
      UPDATE users
      SET "lastActivityAt" = NOW(), "lastSeenAt" = NOW()
      WHERE id = ${session.user.id}
    `;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("presence activity", error);
    return NextResponse.json(
      { error: "No se pudo registrar la actividad" },
      { status: 500 },
    );
  }
}
