"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export type CreateProjectInput = {
  code: string;
  name: string;
  city?: string;
  description?: string;
  clientId?: string;
};

export type ActionResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResult> {
  try {
    const session = await requireSession();

    if (!["ADMIN", "DIRECTOR"].includes(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para crear obras." };
    }

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();

    if (!code || !name) {
      return { ok: false, error: "Código y nombre son obligatorios." };
    }

    const existing = await prisma.project.findUnique({
      where: {
        organizationId_code: {
          organizationId: session.organizationId,
          code,
        },
      },
    });

    if (existing) {
      return { ok: false, error: `Ya existe una obra con código ${code}.` };
    }

    let clientId: string | null = null;
    if (input.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: session.organizationId,
          isActive: true,
        },
      });
      if (!client) {
        return { ok: false, error: "Cliente no válido." };
      }
      clientId = client.id;
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { currency: true },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: session.organizationId,
        createdById: session.user.id,
        clientId,
        code,
        name,
        city: input.city?.trim() || null,
        description: input.description?.trim() || null,
        status: "ACTIVE",
        currency: org?.currency ?? "ARS",
        members: {
          create: {
            userId: session.user.id,
            role: session.organizationRole,
          },
        },
      },
    });

    revalidatePath("/projects");
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("createProject", error);
    return { ok: false, error: "No se pudo crear la obra." };
  }
}
