import { prisma } from "@/lib/prisma";
import { getPlatformSuperadminEmails } from "@/features/auth/lib/platform-admin";

/**
 * Notifica a todos los superadmins de plataforma.
 * `contextOrganizationId` se usa como empresa de la notificación cuando el
 * superadmin no tiene membresía (modo plataforma).
 */
export async function notifyPlatformSuperadmins(input: {
  type: string;
  title: string;
  body: string;
  href: string;
  excludeUserId?: string;
  /** Empresa origen del evento (p. ej. la que creó la solicitud). */
  contextOrganizationId?: string | null;
}) {
  const emails = getPlatformSuperadminEmails();
  if (emails.length === 0) return;

  const users = await prisma.user.findMany({
    where: {
      email: { in: emails, mode: "insensitive" },
      isActive: true,
      ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
    },
    select: {
      id: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { organizationId: true },
      },
    },
  });

  if (users.length === 0) return;

  let fallbackOrgId = input.contextOrganizationId?.trim() || null;
  if (!fallbackOrgId) {
    const anyOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    fallbackOrgId = anyOrg?.id ?? null;
  }
  if (!fallbackOrgId) return;

  const rows = users.map((u) => ({
    organizationId: u.memberships[0]?.organizationId ?? fallbackOrgId!,
    userId: u.id,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
  }));

  await prisma.appNotification.createMany({ data: rows });
}

export async function notifyFeatureRequestUser(input: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string;
}) {
  await prisma.appNotification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    },
  });
}
