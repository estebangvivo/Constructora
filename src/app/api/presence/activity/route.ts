import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

/** Registra interacción del usuario (anti-idle). */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
