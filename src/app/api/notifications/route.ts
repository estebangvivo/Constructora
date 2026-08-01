import { NextRequest, NextResponse } from "next/server";
import { getOrganizationSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const session = await getOrganizationSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50)
    : 20;

  const where = {
    organizationId: session.organizationId,
    userId: session.user.id,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.appNotification.count({
      where: {
        organizationId: session.organizationId,
        userId: session.user.id,
        readAt: null,
      },
    }),
  ]);

  return NextResponse.json(
    {
      unreadCount,
      items: items.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
      })),
    },
    { headers: noStore },
  );
}

/** Marca como leídas: body `{ ids?: string[], all?: true }`. */
export async function PATCH(request: NextRequest) {
  const session = await getOrganizationSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      ids?: unknown;
      all?: unknown;
    };

    const now = new Date();

    if (body.all === true) {
      await prisma.appNotification.updateMany({
        where: {
          organizationId: session.organizationId,
          userId: session.user.id,
          readAt: null,
        },
        data: { readAt: now },
      });
      return NextResponse.json({ ok: true }, { headers: noStore });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Indicá ids o all: true" },
        { status: 400 },
      );
    }

    await prisma.appNotification.updateMany({
      where: {
        id: { in: ids },
        organizationId: session.organizationId,
        userId: session.user.id,
        readAt: null,
      },
      data: { readAt: now },
    });

    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("notifications PATCH", error);
    return NextResponse.json(
      { error: "No se pudieron actualizar las notificaciones" },
      { status: 500 },
    );
  }
}
