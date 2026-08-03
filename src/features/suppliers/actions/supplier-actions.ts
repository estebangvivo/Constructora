"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export type SupplierInput = {
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

export async function createSupplier(
  input: SupplierInput,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para crear proveedores." };
    }

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    const supplier = await prisma.supplier.create({
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

    revalidatePath("/suppliers");
    revalidatePath("/projects");
    revalidatePath("/treasury/payment-orders/new");
    revalidatePath("/treasury/receipts/new");
    return { ok: true, id: supplier.id };
  } catch (error) {
    console.error("createSupplier", error);
    return { ok: false, error: "No se pudo crear el proveedor." };
  }
}

export async function updateSupplier(
  id: string,
  input: SupplierInput & { isActive?: boolean },
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para editar proveedores." };
    }

    const existing = await prisma.supplier.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!existing) return { ok: false, error: "Proveedor no encontrado." };

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    await prisma.supplier.update({
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

    revalidatePath("/suppliers");
    return { ok: true, id };
  } catch (error) {
    console.error("updateSupplier", error);
    return { ok: false, error: "No se pudo actualizar el proveedor." };
  }
}

export async function linkSupplierToProject(input: {
  projectId: string;
  supplierId: string;
  roleNotes?: string;
  isPrimary?: boolean;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "No tienes permiso para vincular proveedores." };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
    });
    if (!project) return { ok: false, error: "Obra no encontrada." };

    const supplier = await prisma.supplier.findFirst({
      where: {
        id: input.supplierId,
        organizationId: session.organizationId,
        isActive: true,
      },
    });
    if (!supplier) return { ok: false, error: "Proveedor no válido." };

    if (input.isPrimary) {
      await prisma.projectSupplier.updateMany({
        where: { projectId: input.projectId },
        data: { isPrimary: false },
      });
    }

    const link = await prisma.projectSupplier.upsert({
      where: {
        projectId_supplierId: {
          projectId: input.projectId,
          supplierId: input.supplierId,
        },
      },
      create: {
        projectId: input.projectId,
        supplierId: input.supplierId,
        roleNotes: input.roleNotes?.trim() || null,
        isPrimary: input.isPrimary ?? false,
      },
      update: {
        roleNotes: input.roleNotes?.trim() || null,
        ...(typeof input.isPrimary === "boolean"
          ? { isPrimary: input.isPrimary }
          : {}),
      },
    });

    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath(`/projects/${input.projectId}/stakeholders`);
    revalidatePath("/suppliers");
    return { ok: true, id: link.id };
  } catch (error) {
    console.error("linkSupplierToProject", error);
    return { ok: false, error: "No se pudo vincular el proveedor." };
  }
}

export async function unlinkSupplierFromProject(
  projectId: string,
  supplierId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return {
        ok: false,
        error: "No tienes permiso para desvincular proveedores.",
      };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
    });
    if (!project) return { ok: false, error: "Obra no encontrada." };

    await prisma.projectSupplier.deleteMany({
      where: { projectId, supplierId },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/stakeholders`);
    revalidatePath("/suppliers");
    return { ok: true, id: projectId };
  } catch (error) {
    console.error("unlinkSupplierFromProject", error);
    return { ok: false, error: "No se pudo desvincular el proveedor." };
  }
}
