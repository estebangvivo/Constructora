import { prisma } from "@/lib/prisma";
import { getPlatformSuperadminEmails } from "@/features/auth/lib/platform-admin";

/** Notifica a todos los superadmins de plataforma (en su membresía primaria). */
export async function notifyPlatformSuperadmins(input: {
  type: string;
  title: string;
  body: string;
  href: string;
  excludeUserId?: string;
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

  const rows = users
    .map((u) => {
      const orgId = u.memberships[0]?.organizationId;
      if (!orgId) return null;
      return {
        organizationId: orgId,
        userId: u.id,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (rows.length === 0) return;
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
