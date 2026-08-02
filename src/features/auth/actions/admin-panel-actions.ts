"use server";

import type { BillingPlan, BillingStatus, OrganizationRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminPanelSession, requireAuthSession } from "@/lib/auth";
import { ROLE_DEFAULT_MODULES } from "@/features/auth/lib/modules";
import {
  normalizeCurrency,
  normalizeEnabledCurrencies,
} from "@/config/currencies";
import type { OrganizationProfile } from "@/features/settings/queries/get-organization";
import {
  isPlatformSuperadmin,
  requirePlatformSuperadmin,
} from "@/features/auth/lib/platform-admin";
import {
  BILLING_PLANS,
  normalizeBillingPlanId,
} from "@/features/billing/lib/plans";

const ONLINE_MS = 2 * 60 * 1000;

export type AdminMemberOverview = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: OrganizationRole;
  isActive: boolean;
  allowedModules: string[];
  lastSeenAt: string | null;
  isOnline: boolean;
};

export type AdminOrganizationOverview = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  onlineCount: number;
  members: AdminMemberOverview[];
  billingStatus: BillingStatus;
  billingPlan: string | null;
  paidUntil: string | null;
};

function requireAdminOrSuperadminSession() {
  return requireAdminPanelSession();
}

async function orgIdsForAdminActor(userId: string, email: string) {
  // Superadmin: todas las empresas, sin importar la org activa ni membresías.
  if (isPlatformSuperadmin({ user: { email } })) {
    const all = await prisma.organization.findMany({
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return all.map((o) => o.id);
  }
  const adminMemberships = await prisma.organizationMember.findMany({
    where: { userId, role: "ADMIN" },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  return adminMemberships.map((m) => m.organizationId);
}

/** Empresas visibles: todas si superadmin; si no, donde el actor es Admin. */
export async function listAdminOrganizationsOverview(): Promise<
  AdminOrganizationOverview[]
> {
  const session = await requireAdminPanelSession();

  const orgIds = await orgIdsForAdminActor(
    session.user.id,
    session.user.email,
  );
  if (orgIds.length === 0) return [];

  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      billingStatus: true,
      billingPlan: true,
      paidUntil: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const userIds = [
    ...new Set(orgs.flatMap((o) => o.members.map((m) => m.user.id))),
  ];
  const lastSeenMap = new Map<string, Date | null>();
  if (userIds.length > 0) {
    try {
      const seenRows = await prisma.$queryRaw<
        Array<{ id: string; lastSeenAt: Date | null }>
      >`
        SELECT id, "lastSeenAt" FROM users WHERE id IN (${Prisma.join(userIds)})
      `;
      for (const row of seenRows) {
        lastSeenMap.set(row.id, row.lastSeenAt);
      }
    } catch (error) {
      console.warn("listAdminOrganizationsOverview lastSeenAt", error);
    }
  }

  const now = Date.now();

  return orgs.map((org) => {
    const members: AdminMemberOverview[] = org.members.map((m) => {
      const lastSeen = lastSeenMap.get(m.user.id) ?? null;
      const lastSeenAt = lastSeen?.toISOString() ?? null;
      const isOnline = Boolean(
        lastSeen && now - lastSeen.getTime() < ONLINE_MS,
      );
      return {
        membershipId: m.id,
        userId: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        role: m.role,
        isActive: m.user.isActive,
        allowedModules:
          m.allowedModules.length > 0
            ? m.allowedModules
            : [...ROLE_DEFAULT_MODULES[m.role]],
        lastSeenAt,
        isOnline,
      };
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      memberCount: members.length,
      onlineCount: members.filter((m) => m.isOnline && m.isActive).length,
      members,
      billingStatus: org.billingStatus,
      billingPlan: org.billingPlan,
      paidUntil: org.paidUntil?.toISOString() ?? null,
    };
  });
}

/** Perfiles de empresas administrables (todas si superadmin). */
export async function listAdminOrganizationProfiles(): Promise<
  OrganizationProfile[]
> {
  try {
    const session = await requireAdminOrSuperadminSession();
    const orgIds = await orgIdsForAdminActor(
      session.user.id,
      session.user.email,
    );
    if (orgIds.length === 0) return [];

    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: {
        id: true,
        name: true,
        legalName: true,
        slug: true,
        taxId: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        postalCode: true,
        country: true,
        website: true,
        logoUrl: true,
        facebookUrl: true,
        instagramUrl: true,
        linkedinUrl: true,
        xUrl: true,
        whatsapp: true,
        themeId: true,
        currency: true,
        enabledCurrencies: true,
        checkDueAlertDays: true,
      },
      orderBy: { name: "asc" },
    });

    const idleMap = new Map<string, number>();
    try {
      const idleRows = await prisma.$queryRaw<
        Array<{ id: string; sessionIdleMinutes: number | null }>
      >`
        SELECT id, "sessionIdleMinutes" FROM organizations WHERE id IN (${Prisma.join(orgIds)})
      `;
      for (const row of idleRows) {
        idleMap.set(
          row.id,
          Math.min(480, Math.max(5, row.sessionIdleMinutes ?? 30)),
        );
      }
    } catch (error) {
      console.warn("listAdminOrganizationProfiles idle", error);
    }

    return orgs.map((org) => ({
      ...org,
      currency: normalizeCurrency(org.currency),
      enabledCurrencies: normalizeEnabledCurrencies(
        org.enabledCurrencies,
        org.currency,
      ),
      checkDueAlertDays: Math.max(0, org.checkDueAlertDays ?? 7),
      sessionIdleMinutes: idleMap.get(org.id) ?? 30,
    }));
  } catch {
    return [];
  }
}

const BILLING_STATUSES: BillingStatus[] = [
  "ACTIVE",
  "PAST_DUE",
  "PENDING_PAYMENT",
  "EXEMPT",
];

function parseBillingPlan(raw: string | null): BillingPlan | null {
  if (!raw || raw === "NONE") return null;
  const normalized = normalizeBillingPlanId(raw);
  if (normalized) return normalized as BillingPlan;
  if (raw === "MONTHLY" || raw === "ANNUAL") return raw;
  if (raw in BILLING_PLANS) return raw as BillingPlan;
  return null;
}

/** Superadmin: cambia estado / plan / vigencia de cualquier empresa. */
export async function updateOrganizationBillingBySuperadmin(input: {
  organizationId: string;
  billingStatus: string;
  billingPlan: string | null;
  paidUntil: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuthSession();
    requirePlatformSuperadmin(session);

    if (!BILLING_STATUSES.includes(input.billingStatus as BillingStatus)) {
      return { ok: false, error: "Estado de facturación inválido." };
    }

    const plan = parseBillingPlan(input.billingPlan);
    if (input.billingPlan && input.billingPlan !== "NONE" && !plan) {
      return { ok: false, error: "Plan inválido." };
    }

    let paidUntil: Date | null = null;
    if (input.paidUntil?.trim()) {
      const raw = input.paidUntil.trim();
      const d = raw.includes("T")
        ? new Date(raw)
        : new Date(`${raw}T23:59:59.999Z`);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: "Fecha de vigencia inválida." };
      }
      paidUntil = d;
    }

    if (input.billingStatus === "ACTIVE" && !paidUntil) {
      return {
        ok: false,
        error: "Para estado ACTIVE indicá una fecha de vigencia.",
      };
    }

    await prisma.organization.update({
      where: { id: input.organizationId },
      data: {
        billingStatus: input.billingStatus as BillingStatus,
        billingPlan: plan,
        paidUntil,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/billing");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("updateOrganizationBillingBySuperadmin", error);
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return { ok: false, error: "Sin permiso de superadmin." };
    }
    return { ok: false, error: "No se pudo actualizar el plan." };
  }
}
