import { NextRequest, NextResponse } from "next/server";
import { getSession, hasOrganization } from "@/lib/auth";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

async function resolveNotificationScope() {
  const session = await getSession();
  if (!session) return null;

  const superadmin = isPlatformSuperadmin(session);
  if (!superadmin && !hasOrganization(session)) return null;

  return {
    userId: session.user.id,
    /**
     * Superadmin: todas las notificaciones del usuario (plataforma / cualquier org).
     * Resto: solo las de la empresa activa.
     */
    organizationId: superadmin ? null : session.organizationId,
    superadmin,
  };
}

export async function GET(request: NextRequest) {
  const scope = await resolveNotificationScope();
  if (!scope) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50)
    : 20;

  const where = {
    userId: scope.userId,
    ...(scope.organizationId
      ? { organizationId: scope.organizationId }
      : {}),
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
        userId: scope.userId,
        ...(scope.organizationId
          ? { organizationId: scope.organizationId }
          : {}),
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
  const scope = await resolveNotificationScope();
  if (!scope) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      ids?: unknown;
      all?: unknown;
    };

    const now = new Date();
    const scopeWhere = {
      userId: scope.userId,
      ...(scope.organizationId
        ? { organizationId: scope.organizationId }
        : {}),
    };

    if (body.all === true) {
      await prisma.appNotification.updateMany({
        where: {
          ...scopeWhere,
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
        ...scopeWhere,
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
