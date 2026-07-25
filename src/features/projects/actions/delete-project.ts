"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ProjectDeleteBlocker = {
  key: string;
  label: string;
  count: number;
};

/** Datos operativos que impiden borrar la obra (no cuenta el membership del creador). */
export async function getProjectDeleteBlockers(
  projectId: string,
): Promise<ProjectDeleteBlocker[]> {
  const session = await requireSession();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: {
      _count: {
        select: {
          budgets: true,
          changeOrders: true,
          certifications: true,
          tasks: true,
          milestones: true,
          dailyReports: true,
          punchItems: true,
          documents: true,
          inventory: true,
          purchaseRequests: true,
          purchaseOrders: true,
          purchaseInvoices: true,
          projectContractors: true,
          projectSuppliers: true,
          receiptLines: true,
          paymentOrderLines: true,
        },
      },
    },
  });

  if (!project) return [{ key: "missing", label: "Obra no encontrada", count: 1 }];

  const c = project._count;
  const checks: ProjectDeleteBlocker[] = [
    { key: "budgets", label: "presupuestos", count: c.budgets },
    { key: "changeOrders", label: "órdenes de cambio", count: c.changeOrders },
    { key: "certifications", label: "certificaciones", count: c.certifications },
    { key: "tasks", label: "tareas de cronograma", count: c.tasks },
    { key: "milestones", label: "hitos", count: c.milestones },
    { key: "dailyReports", label: "partes diarios", count: c.dailyReports },
    { key: "punchItems", label: "observaciones (punch list)", count: c.punchItems },
    { key: "documents", label: "documentos", count: c.documents },
    { key: "inventory", label: "ítems de inventario", count: c.inventory },
    { key: "purchaseRequests", label: "solicitudes de compra", count: c.purchaseRequests },
    { key: "purchaseOrders", label: "órdenes de compra", count: c.purchaseOrders },
    { key: "purchaseInvoices", label: "facturas de compra", count: c.purchaseInvoices },
    { key: "projectContractors", label: "contratistas", count: c.projectContractors },
    { key: "projectSuppliers", label: "proveedores vinculados", count: c.projectSuppliers },
    { key: "receiptLines", label: "líneas de recibos", count: c.receiptLines },
    { key: "paymentOrderLines", label: "líneas de órdenes de pago", count: c.paymentOrderLines },
  ];

  return checks.filter((x) => x.count > 0);
}

function formatBlockers(blockers: ProjectDeleteBlocker[]): string {
  const parts = blockers.map((b) => `${b.count} ${b.label}`);
  if (parts.length <= 2) return parts.join(" y ");
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();

    if (!["ADMIN", "DIRECTOR"].includes(session.organizationRole)) {
      return { ok: false, error: "No tenés permiso para eliminar obras." };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      select: { id: true, code: true, name: true },
    });

    if (!project) {
      return { ok: false, error: "Obra no encontrada." };
    }

    const blockers = await getProjectDeleteBlockers(projectId);
    if (blockers.length > 0) {
      return {
        ok: false,
        error: `No se puede eliminar: la obra tiene ${formatBlockers(blockers)}. Borrá esos datos primero o pedí una limpieza.`,
      };
    }

    await prisma.project.delete({
      where: { id: project.id },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    console.error("deleteProject", error);
    return { ok: false, error: "No se pudo eliminar la obra." };
  }
}
