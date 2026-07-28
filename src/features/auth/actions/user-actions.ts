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

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type TurneroPuestoOption = {
  id: string;
  nombre: string;
  categoria: string;
  activo: boolean;
};

function canManageUsers(role: string) {
  return role === "ADMIN" || role === "DIRECTOR";
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
        },
      },
      turneroPuesto: {
        select: { id: true, nombre: true, categoria: true, activo: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

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
    createdAt: m.user.createdAt,
  }));
}

export async function createOrganizationUser(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password: string;
  role: OrganizationRole;
  allowedModules: string[];
  turneroPuestoId?: string | null;
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
    const password = input.password;
    if (!email || !password) {
      return { ok: false, error: "Email y contraseña son obligatorios." };
    }
    if (password.length < 6) {
      return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }

    const puestoResult = await resolveTurneroPuestoId(
      session.organizationId,
      input.turneroPuestoId,
    );
    if (!puestoResult.ok) return puestoResult;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const alreadyMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: session.organizationId,
            userId: existing.id,
          },
        },
      });
      if (alreadyMember) {
        return { ok: false, error: "Ese email ya está en la organización." };
      }
    }

    const modules = sanitizeModules(input.role, input.allowedModules);
    const passwordHash = await hashPassword(password);

    const user =
      existing ??
      (await prisma.user.create({
        data: {
          authId: `local:${email}`,
          email,
          passwordHash,
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          phone: input.phone?.trim() || null,
          isActive: true,
        },
      }));

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          firstName: input.firstName?.trim() || existing.firstName,
          lastName: input.lastName?.trim() || existing.lastName,
          phone: input.phone?.trim() || existing.phone,
          isActive: true,
        },
      });
    }

    const membership = await prisma.organizationMember.create({
      data: {
        organizationId: session.organizationId,
        userId: user.id,
        role: input.role,
        allowedModules: modules,
        turneroPuestoId: puestoResult.id,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    return { ok: true, id: membership.id };
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

    await prisma.$transaction([
      prisma.user.update({
        where: { id: input.userId },
        data: {
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          phone: input.phone?.trim() || null,
          isActive: input.isActive,
          ...(passwordHash ? { passwordHash } : {}),
        },
      }),
      prisma.organizationMember.update({
        where: { id: membership.id },
        data: {
          role: input.role,
          allowedModules: modules,
          turneroPuestoId: puestoResult.id,
        },
      }),
    ]);

    revalidatePath("/settings");
    revalidatePath("/settings/users");
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
    return { ok: true, id: userId };
  } catch (error) {
    console.error("removeOrganizationUser", error);
    return { ok: false, error: "No se pudo quitar el usuario." };
  }
}
