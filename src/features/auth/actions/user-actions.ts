"use server";

import { revalidatePath } from "next/cache";
import type { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { hashPassword } from "@/features/auth/lib/password";
import {
  APP_MODULE_KEYS,
  ROLE_DEFAULT_MODULES,
  type AppModuleKey,
} from "@/features/auth/lib/modules";
import { assertOrgCanAddMembers } from "@/features/billing/lib/seats";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type TurneroPuestoOption = {
  id: string;
  nombre: string;
  categoria: string;
  activo: boolean;
};

export type ManageableOrganization = {
  id: string;
  name: string;
  slug: string;
};

function canManageUsers(role: string) {
  return role === "ADMIN" || role === "DIRECTOR";
}

/** Empresas donde el usuario actual puede gestionar miembros. */
export async function listManageableOrganizationsForUsers(): Promise<
  ManageableOrganization[]
> {
  const session = await requireSession();
  if (!canManageUsers(session.organizationRole)) return [];

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: session.user.id,
      role: { in: ["ADMIN", "DIRECTOR"] },
    },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
  }));
}

async function assertManageableOrganizationIds(
  userId: string,
  organizationIds: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const unique = [...new Set(organizationIds.filter(Boolean))];
  if (unique.length === 0) {
    return { ok: false, error: "Seleccioná al menos una empresa." };
  }

  const allowed = await prisma.organizationMember.findMany({
    where: {
      userId,
      role: { in: ["ADMIN", "DIRECTOR"] },
      organizationId: { in: unique },
    },
    select: { organizationId: true },
  });
  if (allowed.length !== unique.length) {
    return {
      ok: false,
      error: "Solo podés asignar empresas donde sos Admin o Dirección.",
    };
  }
  return { ok: true, ids: unique };
}

function sanitizeModules(
  role: OrganizationRole,
  modules: string[],
): AppModuleKey[] {
  if (role === "ADMIN") return [...APP_MODULE_KEYS];
  const set = new Set(modules);
  return APP_MODULE_KEYS.filter((k) => set.has(k));
}

async function resolveTurneroPuestoId(
  organizationId: string,
  raw: string | null | undefined,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (raw == null || raw === "") return { ok: true, id: null };
  const puesto = await prisma.turneroPuesto.findFirst({
    where: {
      id: raw,
      organizationId,
      activo: true,
    },
    select: { id: true },
  });
  if (!puesto) {
    return { ok: false, error: "El puesto de turnero no existe o está inactivo." };
  }
  return { ok: true, id: puesto.id };
}

/** Puestos activos para el select de usuarios. */
export async function listTurneroPuestosForUsers(): Promise<
  TurneroPuestoOption[]
> {
  const session = await requireSession();
  if (!canManageUsers(session.organizationRole)) return [];

  return prisma.turneroPuesto.findMany({
    where: { organizationId: session.organizationId, activo: true },
    select: { id: true, nombre: true, categoria: true, activo: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
}

/** Puesto asignado al usuario actual (para el panel operador). */
export async function getMyAssignedTurneroPuesto(): Promise<{
  id: string;
  nombre: string;
  categoria: string;
} | null> {
  const session = await requireSession();
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.organizationId,
        userId: session.user.id,
      },
    },
    select: {
      turneroPuesto: {
        select: { id: true, nombre: true, categoria: true, activo: true },
      },
    },
  });
  const puesto = membership?.turneroPuesto;
  if (!puesto || !puesto.activo) return null;
  return {
    id: puesto.id,
    nombre: puesto.nombre,
    categoria: puesto.categoria,
  };
}

export async function listOrganizationUsers() {
  const session = await requireSession();
  if (!canManageUsers(session.organizationRole)) {
    return [];
  }

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: session.organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          passwordHash: true,
          createdAt: true,
          memberships: {
            select: {
              organizationId: true,
              organization: { select: { id: true, name: true } },
            },
          },
        },
      },
      turneroPuesto: {
        select: { id: true, nombre: true, categoria: true, activo: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const manageable = await listManageableOrganizationsForUsers();
  const manageableIds = new Set(manageable.map((o) => o.id));

  return members.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    email: m.user.email,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    phone: m.user.phone,
    isActive: m.user.isActive,
    hasPassword: Boolean(m.user.passwordHash),
    role: m.role,
    allowedModules:
      m.allowedModules.length > 0
        ? m.allowedModules
        : [...ROLE_DEFAULT_MODULES[m.role]],
    turneroPuestoId: m.turneroPuestoId,
    turneroPuestoNombre: m.turneroPuesto?.activo
      ? m.turneroPuesto.nombre
      : null,
    organizationIds: m.user.memberships
      .filter((mem) => manageableIds.has(mem.organizationId))
      .map((mem) => mem.organizationId),
    organizations: m.user.memberships
      .filter((mem) => manageableIds.has(mem.organizationId))
      .map((mem) => ({
        id: mem.organization.id,
        name: mem.organization.name,
      })),
    createdAt: m.user.createdAt,
  }));
}

export async function createOrganizationUser(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** Obligatoria solo si el email es nuevo. Si el user ya existe, se ignora. */
  password?: string;
  role: OrganizationRole;
  allowedModules: string[];
  turneroPuestoId?: string | null;
  /** Empresas a las que tendrá acceso (debe incluir al menos una gestionable). */
  organizationIds?: string[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManageUsers(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para gestionar usuarios." };
    }
    if (input.role === "ADMIN" && session.organizationRole !== "ADMIN") {
      return { ok: false, error: "Solo un Admin puede crear otros Admin." };
    }

    const email = input.email.trim().toLowerCase();
    const password = input.password?.trim() ?? "";
    if (!email) {
      return { ok: false, error: "El email es obligatorio." };
    }

    const orgCheck = await assertManageableOrganizationIds(
      session.user.id,
      input.organizationIds?.length
        ? input.organizationIds
        : [session.organizationId],
    );
    if (!orgCheck.ok) return orgCheck;
    const orgIds = orgCheck.ids;

    const puestoResult = await resolveTurneroPuestoId(
      session.organizationId,
      input.turneroPuestoId,
    );
    if (!puestoResult.ok) return puestoResult;

    const modules = sanitizeModules(input.role, input.allowedModules);
    const existing = await prisma.user.findUnique({ where: { email } });

    const alreadyMemberOrgIds = existing
      ? new Set(
          (
            await prisma.organizationMember.findMany({
              where: {
                userId: existing.id,
                organizationId: { in: orgIds },
              },
              select: { organizationId: true },
            })
          ).map((m) => m.organizationId),
        )
      : new Set<string>();

    for (const organizationId of orgIds) {
      if (alreadyMemberOrgIds.has(organizationId)) continue;
      const seat = await assertOrgCanAddMembers(organizationId, 1);
      if (!seat.ok) return seat;
    }

    let userId: string;

    if (existing) {
      if (alreadyMemberOrgIds.size === orgIds.length) {
        return {
          ok: false,
          error: "Ese email ya está en todas las empresas seleccionadas.",
        };
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: existing.firstName || input.firstName?.trim() || null,
          lastName: existing.lastName || input.lastName?.trim() || null,
          phone: existing.phone || input.phone?.trim() || null,
          isActive: true,
        },
      });
      userId = existing.id;
    } else {
      if (!password) {
        return {
          ok: false,
          error: "La contraseña es obligatoria para un usuario nuevo.",
        };
      }
      if (password.length < 6) {
        return {
          ok: false,
          error: "La contraseña debe tener al menos 6 caracteres.",
        };
      }

      const user = await prisma.user.create({
        data: {
          authId: `local:${email}`,
          email,
          passwordHash: await hashPassword(password),
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          phone: input.phone?.trim() || null,
          isActive: true,
        },
      });
      userId = user.id;
    }

    let primaryMembershipId: string | undefined;
    for (const organizationId of orgIds) {
      const existingMem = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId },
        },
      });
      if (existingMem) continue;

      const membership = await prisma.organizationMember.create({
        data: {
          organizationId,
          userId,
          role: input.role,
          allowedModules: modules,
          turneroPuestoId:
            organizationId === session.organizationId ? puestoResult.id : null,
        },
      });
      if (organizationId === session.organizationId) {
        primaryMembershipId = membership.id;
      }
    }

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    revalidatePath("/admin");
    return { ok: true, id: primaryMembershipId };
  } catch (error) {
    console.error("createOrganizationUser", error);
    return { ok: false, error: "No se pudo crear el usuario." };
  }
}

export async function updateOrganizationUser(input: {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: OrganizationRole;
  allowedModules: string[];
  isActive: boolean;
  password?: string;
  turneroPuestoId?: string | null;
  organizationIds?: string[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManageUsers(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para gestionar usuarios." };
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: session.organizationId,
          userId: input.userId,
        },
      },
      include: { user: true },
    });
    if (!membership) {
      return { ok: false, error: "Usuario no encontrado en la organización." };
    }

    if (input.role === "ADMIN" && session.organizationRole !== "ADMIN") {
      return { ok: false, error: "Solo un Admin puede asignar rol Admin." };
    }

    if (
      membership.userId === session.user.id &&
      input.role !== "ADMIN" &&
      session.organizationRole === "ADMIN"
    ) {
      const otherAdmins = await prisma.organizationMember.count({
        where: {
          organizationId: session.organizationId,
          role: "ADMIN",
          userId: { not: session.user.id },
        },
      });
      if (otherAdmins === 0) {
        return {
          ok: false,
          error: "No podés quitarte el rol Admin: sos el único administrador.",
        };
      }
    }

    if (input.password && input.password.length < 6) {
      return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }

    const puestoResult = await resolveTurneroPuestoId(
      session.organizationId,
      input.turneroPuestoId,
    );
    if (!puestoResult.ok) return puestoResult;

    const modules = sanitizeModules(input.role, input.allowedModules);
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : undefined;

    const manageable = await listManageableOrganizationsForUsers();
    const manageableIds = new Set(manageable.map((o) => o.id));

    let desiredOrgIds: string[] | null = null;
    if (input.organizationIds) {
      const orgCheck = await assertManageableOrganizationIds(
        session.user.id,
        input.organizationIds,
      );
      if (!orgCheck.ok) return orgCheck;
      desiredOrgIds = orgCheck.ids;
      if (!desiredOrgIds.includes(session.organizationId)) {
        // Evitar que al editar desde esta empresa se auto-expulsara sin querer
        // si desmarcó la actual: exigir que quede al menos la actual o avisar.
        return {
          ok: false,
          error:
            "Tenés que dejar marcada la empresa actual (desde la que estás editando).",
        };
      }

      const currentManaged = await prisma.organizationMember.findMany({
        where: {
          userId: input.userId,
          organizationId: { in: [...manageableIds] },
        },
        select: { organizationId: true },
      });
      const currentSet = new Set(currentManaged.map((m) => m.organizationId));
      for (const organizationId of desiredOrgIds) {
        if (currentSet.has(organizationId)) continue;
        const seat = await assertOrgCanAddMembers(organizationId, 1);
        if (!seat.ok) return seat;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          phone: input.phone?.trim() || null,
          isActive: input.isActive,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });

      await tx.organizationMember.update({
        where: { id: membership.id },
        data: {
          role: input.role,
          allowedModules: modules,
          turneroPuestoId: puestoResult.id,
        },
      });

      if (desiredOrgIds) {
        const desired = new Set(desiredOrgIds);
        const currentManaged = await tx.organizationMember.findMany({
          where: {
            userId: input.userId,
            organizationId: { in: [...manageableIds] },
          },
          select: { id: true, organizationId: true },
        });

        for (const mem of currentManaged) {
          if (!desired.has(mem.organizationId)) {
            if (
              mem.organizationId === session.organizationId &&
              input.userId === session.user.id
            ) {
              continue; // no auto-expulsarse de la sesión actual
            }
            await tx.organizationMember.delete({ where: { id: mem.id } });
          }
        }

        for (const organizationId of desiredOrgIds) {
          const exists = currentManaged.some(
            (m) => m.organizationId === organizationId,
          );
          if (exists) continue;
          await tx.organizationMember.create({
            data: {
              organizationId,
              userId: input.userId,
              role: input.role,
              allowedModules: modules,
              turneroPuestoId: null,
            },
          });
        }
      }
    });

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    return { ok: true, id: input.userId };
  } catch (error) {
    console.error("updateOrganizationUser", error);
    return { ok: false, error: "No se pudo actualizar el usuario." };
  }
}

export async function removeOrganizationUser(
  userId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (session.organizationRole !== "ADMIN") {
      return { ok: false, error: "Solo un Admin puede quitar usuarios." };
    }
    if (userId === session.user.id) {
      return { ok: false, error: "No podés eliminarte a vos mismo." };
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: session.organizationId,
          userId,
        },
      },
    });
    if (!membership) {
      return { ok: false, error: "Usuario no encontrado." };
    }

    await prisma.organizationMember.delete({ where: { id: membership.id } });
    revalidatePath("/settings/users");
    revalidatePath("/admin");
    return { ok: true, id: userId };
  } catch (error) {
    console.error("removeOrganizationUser", error);
    return { ok: false, error: "No se pudo quitar el usuario." };
  }
}
