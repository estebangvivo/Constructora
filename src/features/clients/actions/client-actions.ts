"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export type ClientInput = {
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactName?: string;
  notes?: string;
};

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

export async function createClient(input: ClientInput): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para crear clientes." };
    }

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    const client = await prisma.client.create({
      data: {
        organizationId: session.organizationId,
        name,
        taxId: input.taxId?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        contactName: input.contactName?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    revalidatePath("/clients");
    revalidatePath("/projects");
    revalidatePath("/proposals");
    revalidatePath("/treasury/receipts/new");
    return { ok: true, id: client.id };
  } catch (error) {
    console.error("createClient", error);
    return { ok: false, error: "No se pudo crear el cliente." };
  }
}

export async function updateClient(
  id: string,
  input: ClientInput & { isActive?: boolean },
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para editar clientes." };
    }

    const existing = await prisma.client.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!existing) return { ok: false, error: "Cliente no encontrado." };

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    await prisma.client.update({
      where: { id },
      data: {
        name,
        taxId: input.taxId?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        contactName: input.contactName?.trim() || null,
        notes: input.notes?.trim() || null,
        ...(typeof input.isActive === "boolean"
          ? { isActive: input.isActive }
          : {}),
      },
    });

    revalidatePath("/clients");
    revalidatePath("/projects");
    return { ok: true, id };
  } catch (error) {
    console.error("updateClient", error);
    return { ok: false, error: "No se pudo actualizar el cliente." };
  }
}

export async function setProjectClient(
  projectId: string,
  clientId: string | null,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para asignar el cliente." };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
    });
    if (!project) return { ok: false, error: "Obra no encontrada." };

    if (clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          organizationId: session.organizationId,
          isActive: true,
        },
      });
      if (!client) return { ok: false, error: "Cliente no válido." };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { clientId },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    revalidatePath("/clients");
    return { ok: true, id: projectId };
  } catch (error) {
    console.error("setProjectClient", error);
    return { ok: false, error: "No se pudo asignar el cliente." };
  }
}
