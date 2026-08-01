import type { OrganizationRole, User } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  DEV_USER_AUTH_ID,
  isClerkConfigured,
  isDevAuthBypass,
} from "@/lib/auth-config";
import {
  resolveAllowedModules,
  type AppModuleKey,
} from "@/features/auth/lib/modules";
import {
  clearLocalSessionCookie,
  readLocalSessionFromCookies,
} from "@/features/auth/lib/session";
import type { AppRole } from "@/types";

export type SessionContext = {
  user: User;
  /** null = sin empresa (onboarding / pago). */
  organizationId: string | null;
  organizationRole: OrganizationRole | null;
  role: AppRole | null;
  allowedModules: AppModuleKey[];
};

/** Sesión con empresa activa (dashboard / APIs de tenant). */
export type OrganizationSession = SessionContext & {
  organizationId: string;
  organizationRole: OrganizationRole;
  role: AppRole;
};

export function hasOrganization(
  session: SessionContext,
): session is OrganizationSession {
  return Boolean(
    session.organizationId && session.organizationRole && session.role,
  );
}

function toAppRole(role: OrganizationRole): AppRole {
  return role as AppRole;
}

async function sessionFromMembership(
  user: User,
  organizationId: string,
  organizationRole: OrganizationRole,
  allowedModulesStored: string[],
): Promise<SessionContext> {
  return {
    user,
    organizationId,
    organizationRole,
    role: toAppRole(organizationRole),
    allowedModules: resolveAllowedModules(
      organizationRole,
      allowedModulesStored,
    ),
  };
}

function sessionWithoutOrg(user: User): SessionContext {
  return {
    user,
    organizationId: null,
    organizationRole: null,
    role: null,
    allowedModules: ["home"],
  };
}

async function touchIdleCheck(
  userId: string,
  organizationId: string | null,
): Promise<boolean> {
  let idleMinutes = 30;
  let lastActivityAt: Date | null = null;
  try {
    if (organizationId) {
      const idleRows = await prisma.$queryRaw<
        Array<{ sessionIdleMinutes: number | null; lastActivityAt: Date | null }>
      >`
        SELECT o."sessionIdleMinutes" AS "sessionIdleMinutes", u."lastActivityAt" AS "lastActivityAt"
        FROM organizations o
        CROSS JOIN users u
        WHERE o.id = ${organizationId} AND u.id = ${userId}
        LIMIT 1
      `;
      const row = idleRows[0];
      if (row) {
        idleMinutes = Math.min(480, Math.max(5, row.sessionIdleMinutes ?? 30));
        lastActivityAt = row.lastActivityAt;
      }
    } else {
      const idleRows = await prisma.$queryRaw<
        Array<{ lastActivityAt: Date | null }>
      >`
        SELECT "lastActivityAt" FROM users WHERE id = ${userId} LIMIT 1
      `;
      lastActivityAt = idleRows[0]?.lastActivityAt ?? null;
      idleMinutes = 30;
    }
  } catch (error) {
    console.warn("touchIdleCheck", error);
    return true;
  }

  if (lastActivityAt) {
    const idleMs = idleMinutes * 60_000;
    if (Date.now() - lastActivityAt.getTime() > idleMs) {
      await clearLocalSessionCookie();
      return false;
    }
  }
  return true;
}

async function getLocalCookieSession(): Promise<SessionContext | null> {
  const local = await readLocalSessionFromCookies();
  if (!local) return null;

  const user = await prisma.user.findFirst({
    where: { id: local.userId, isActive: true },
  });
  if (!user) return null;

  if (!local.organizationId) {
    const ok = await touchIdleCheck(user.id, null);
    if (!ok) return null;
    return sessionWithoutOrg(user);
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: local.organizationId,
        userId: user.id,
      },
    },
  });
  if (!membership) {
    // Membresía perdida: sesión sin org
    const ok = await touchIdleCheck(user.id, null);
    if (!ok) return null;
    return sessionWithoutOrg(user);
  }

  const ok = await touchIdleCheck(user.id, membership.organizationId);
  if (!ok) return null;

  return sessionFromMembership(
    user,
    membership.organizationId,
    membership.role,
    membership.allowedModules,
  );
}

async function getDevSession(): Promise<SessionContext | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { authId: DEV_USER_AUTH_ID },
    });
    if (!user || !user.isActive) return null;

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) return sessionWithoutOrg(user);

    return sessionFromMembership(
      user,
      membership.organizationId,
      membership.role,
      membership.allowedModules,
    );
  } catch (error) {
    console.error("getDevSession: base de datos no disponible", error);
    return null;
  }
}

/** Sync Clerk → User. No crea empresa automáticamente (va por onboarding/pago). */
export async function syncClerkUser(authId: string): Promise<User> {
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    `${authId}@users.local`;

  return prisma.user.upsert({
    where: { authId },
    create: {
      authId,
      email,
      firstName: clerkUser?.firstName ?? null,
      lastName: clerkUser?.lastName ?? null,
      avatarUrl: clerkUser?.imageUrl ?? null,
    },
    update: {
      email,
      firstName: clerkUser?.firstName ?? null,
      lastName: clerkUser?.lastName ?? null,
      avatarUrl: clerkUser?.imageUrl ?? null,
    },
  });
}

/**
 * Sesión: 1) cookie local (login email/password)
 * 2) bypass de desarrollo
 * 3) Clerk
 */
export async function getSession(): Promise<SessionContext | null> {
  try {
    const local = await getLocalCookieSession();
    if (local) return local;

    if (isDevAuthBypass()) {
      return getDevSession();
    }

    if (!isClerkConfigured()) return null;

    const { userId } = await auth();
    if (!userId) return null;

    await syncClerkUser(userId);

    const user = await prisma.user.findUnique({ where: { authId: userId } });
    if (!user || !user.isActive) return null;

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) return sessionWithoutOrg(user);

    return sessionFromMembership(
      user,
      membership.organizationId,
      membership.role,
      membership.allowedModules,
    );
  } catch (error) {
    console.error("getSession", error);
    return null;
  }
}

export async function requireSession(): Promise<OrganizationSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  if (!hasOrganization(session)) {
    throw new Error("NO_ORGANIZATION");
  }
  return session;
}

/** Sesión autenticada (con o sin empresa). Para onboarding / billing. */
export async function requireAuthSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

/** Alias explícito de requireSession (empresa obligatoria). */
export async function requireOrganizationSession(): Promise<OrganizationSession> {
  return requireSession();
}

/** Como getSession pero solo si hay empresa (null → onboarding). */
export async function getOrganizationSession(): Promise<OrganizationSession | null> {
  const session = await getSession();
  if (!session || !hasOrganization(session)) return null;
  return session;
}

export async function getProjectRole(
  projectId: string,
  userId: string,
  fallback: OrganizationRole,
): Promise<OrganizationRole> {
  const membership = await prisma.projectMembership.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });
  return membership?.role ?? fallback;
}
