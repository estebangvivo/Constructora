"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, requireSession } from "@/lib/auth";
import {
  setLocalSessionCookie,
  signLocalSession,
} from "@/features/auth/lib/session";
import { normalizeOrgSlug } from "@/features/auth/lib/org-slug";

export type OrgActionResult =
  | { ok: true; organizationId?: string }
  | { ok: false; error: string };

export type MyOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
  isActive: boolean;
};

export async function listMyOrganizations(): Promise<MyOrganization[]> {
  const session = await getSession();
  if (!session) return [];

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    isActive: m.organizationId === session.organizationId,
  }));
}

export async function switchOrganization(
  organizationId: string,
): Promise<OrgActionResult> {
  try {
    const session = await requireSession();
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id,
        },
      },
    });
    if (!membership) {
      return { ok: false, error: "No pertenecés a esa empresa." };
    }

    const token = await signLocalSession({
      userId: session.user.id,
      organizationId: membership.organizationId,
    });
    await setLocalSessionCookie(token);
    revalidatePath("/", "layout");
    return { ok: true, organizationId: membership.organizationId };
  } catch (error) {
    console.error("switchOrganization", error);
    return { ok: false, error: "No se pudo cambiar de empresa." };
  }
}

export async function createOrganization(input: {
  name: string;
  slug?: string;
}): Promise<OrgActionResult> {
  try {
    const session = await requireSession();
    const name = input.name.trim();
    if (name.length < 2) {
      return { ok: false, error: "Indicá el nombre de la empresa." };
    }

    const slug = normalizeOrgSlug(input.slug?.trim() || name);
    if (slug.length < 2) {
      return {
        ok: false,
        error: "El identificador (slug) debe tener al menos 2 caracteres.",
      };
    }

    const taken = await prisma.organization.findUnique({ where: { slug } });
    if (taken) {
      return {
        ok: false,
        error: "Ese identificador ya está en uso. Probá otro slug.",
      };
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        currency: "ARS",
        enabledCurrencies: ["ARS", "USD"],
        themeId: "obra",
        country: "AR",
        members: {
          create: {
            userId: session.user.id,
            role: "ADMIN",
            allowedModules: [],
          },
        },
      },
    });

    const token = await signLocalSession({
      userId: session.user.id,
      organizationId: org.id,
    });
    await setLocalSessionCookie(token);
    revalidatePath("/", "layout");
    return { ok: true, organizationId: org.id };
  } catch (error) {
    console.error("createOrganization", error);
    return { ok: false, error: "No se pudo crear la empresa." };
  }
}
