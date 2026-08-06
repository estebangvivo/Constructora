"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { normalizeCurrency } from "@/config/currencies";
import type { ProposalStatus } from "@prisma/client";

export type ProposalItemInput = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  currency?: string;
};

export type ActionResult =
  | { ok: true; proposalId?: string; itemId?: string; projectId?: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function canApprove(role: string) {
  return ["ADMIN", "DIRECTOR"].includes(role);
}

function revalidateProposal(proposalId?: string) {
  revalidatePath("/proposals");
  if (proposalId) revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/projects");
}

function normalizeItem(input: ProposalItemInput, fallbackCurrency = "ARS") {
  const code = input.code.trim();
  const description = input.description.trim();
  const unit = input.unit.trim() || "u";
  const quantity = Number(input.quantity);
  const unitCost = Number(input.unitCost);
  const currency = normalizeCurrency(input.currency || fallbackCurrency);

  if (!code || !description) {
    throw new Error("Código y descripción son obligatorios.");
  }
  if (!(quantity >= 0) || Number.isNaN(quantity)) {
    throw new Error("La cantidad no es válida.");
  }
  if (!(unitCost >= 0) || Number.isNaN(unitCost)) {
    throw new Error("El costo unitario no es válido.");
  }

  const totalCost = Number((quantity * unitCost).toFixed(2));
  return { code, description, unit, quantity, unitCost, totalCost, currency };
}

async function getEditableProposal(proposalId: string, organizationId: string) {
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, organizationId },
  });
  if (!proposal) throw new Error("Presupuesto no encontrado.");
  if (proposal.status === "CONVERTED" || proposal.status === "REJECTED") {
    throw new Error("Este presupuesto ya no se puede editar.");
  }
  return proposal;
}

export async function createProposal(input: {
  code: string;
  name: string;
  city?: string;
  description?: string;
  clientId?: string;
  currency?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para crear presupuestos." };
    }

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) {
      return { ok: false, error: "Código y nombre son obligatorios." };
    }

    const existing = await prisma.proposal.findUnique({
      where: {
        organizationId_code: {
          organizationId: session.organizationId,
          code,
        },
      },
    });
    if (existing) {
      return { ok: false, error: `Ya existe un presupuesto con código ${code}.` };
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
      if (!client) return { ok: false, error: "Cliente no válido." };
      clientId = client.id;
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { currency: true },
    });

    const proposal = await prisma.proposal.create({
      data: {
        organizationId: session.organizationId,
        createdById: session.user.id,
        clientId,
        code,
        name,
        city: input.city?.trim() || null,
        description: input.description?.trim() || null,
        notes: input.notes?.trim() || null,
        currency: normalizeCurrency(
          input.currency || org?.currency || "ARS",
        ),
        status: "DRAFT",
      },
    });

    revalidateProposal(proposal.id);
    return { ok: true, proposalId: proposal.id };
  } catch (error) {
    console.error("createProposal", error);
    return { ok: false, error: "No se pudo crear el presupuesto." };
  }
}

export async function updateProposalMeta(input: {
  proposalId: string;
  name: string;
  city?: string;
  description?: string;
  clientId?: string | null;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    await getEditableProposal(input.proposalId, session.organizationId);

    const name = input.name.trim();
    if (!name) return { ok: false, error: "El nombre es obligatorio." };

    let clientId: string | null | undefined = undefined;
    if (input.clientId === null || input.clientId === "") {
      clientId = null;
    } else if (input.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: session.organizationId,
          isActive: true,
        },
      });
      if (!client) return { ok: false, error: "Cliente no válido." };
      clientId = client.id;
    }

    await prisma.proposal.update({
      where: { id: input.proposalId },
      data: {
        name,
        city: input.city?.trim() || null,
        description: input.description?.trim() || null,
        notes: input.notes?.trim() || null,
        ...(clientId !== undefined ? { clientId } : {}),
      },
    });

    revalidateProposal(input.proposalId);
    return { ok: true, proposalId: input.proposalId };
  } catch (error) {
    console.error("updateProposalMeta", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar.",
    };
  }
}

export async function setProposalStatus(input: {
  proposalId: string;
  status: Extract<ProposalStatus, "DRAFT" | "SENT" | "REJECTED">;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const proposal = await prisma.proposal.findFirst({
      where: {
        id: input.proposalId,
        organizationId: session.organizationId,
      },
    });
    if (!proposal) return { ok: false, error: "Presupuesto no encontrado." };
    if (proposal.status === "CONVERTED") {
      return { ok: false, error: "Ya fue convertido en obra." };
    }

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        status: input.status,
        sentAt: input.status === "SENT" ? new Date() : proposal.sentAt,
        rejectedAt: input.status === "REJECTED" ? new Date() : null,
      },
    });

    revalidateProposal(proposal.id);
    return { ok: true, proposalId: proposal.id };
  } catch (error) {
    console.error("setProposalStatus", error);
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

export async function addProposalItem(input: {
  proposalId: string;
  item: ProposalItemInput;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const proposal = await getEditableProposal(
      input.proposalId,
      session.organizationId,
    );
    const item = normalizeItem(input.item, proposal.currency);
    const maxSort = await prisma.proposalItem.aggregate({
      where: { proposalId: proposal.id },
      _max: { sortOrder: true },
    });

    const created = await prisma.proposalItem.create({
      data: {
        proposalId: proposal.id,
        ...item,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    revalidateProposal(proposal.id);
    return { ok: true, itemId: created.id };
  } catch (error) {
    console.error("addProposalItem", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo agregar.",
    };
  }
}

export async function updateProposalItem(input: {
  itemId: string;
  item: ProposalItemInput;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.proposalItem.findFirst({
      where: {
        id: input.itemId,
        proposal: { organizationId: session.organizationId },
      },
      include: { proposal: true },
    });
    if (!existing) return { ok: false, error: "Partida no encontrada." };
    if (
      existing.proposal.status === "CONVERTED" ||
      existing.proposal.status === "REJECTED"
    ) {
      return { ok: false, error: "Este presupuesto ya no se puede editar." };
    }

    const item = normalizeItem(input.item, existing.proposal.currency);
    await prisma.proposalItem.update({
      where: { id: existing.id },
      data: item,
    });

    revalidateProposal(existing.proposalId);
    return { ok: true, itemId: existing.id };
  } catch (error) {
    console.error("updateProposalItem", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function deleteProposalItem(input: {
  itemId: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.proposalItem.findFirst({
      where: {
        id: input.itemId,
        proposal: { organizationId: session.organizationId },
      },
      include: { proposal: true },
    });
    if (!existing) return { ok: false, error: "Partida no encontrada." };
    if (
      existing.proposal.status === "CONVERTED" ||
      existing.proposal.status === "REJECTED"
    ) {
      return { ok: false, error: "Este presupuesto ya no se puede editar." };
    }

    await prisma.proposalItem.delete({ where: { id: existing.id } });
    revalidateProposal(existing.proposalId);
    return { ok: true };
  } catch (error) {
    console.error("deleteProposalItem", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}

/**
 * Aprueba el presupuesto previo y genera la obra + presupuesto de obra.
 */
export async function approveProposalAndCreateProject(input: {
  proposalId: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canApprove(session.organizationRole)) {
      return {
        ok: false,
        error: "Solo Admin o Director pueden aprobar y crear la obra.",
      };
    }

    const proposal = await prisma.proposal.findFirst({
      where: {
        id: input.proposalId,
        organizationId: session.organizationId,
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!proposal) return { ok: false, error: "Presupuesto no encontrado." };
    if (proposal.status === "CONVERTED" || proposal.convertedProjectId) {
      return {
        ok: false,
        error: "Este presupuesto ya fue convertido en obra.",
      };
    }
    if (proposal.status === "REJECTED") {
      return { ok: false, error: "El presupuesto está rechazado." };
    }
    if (proposal.items.length === 0) {
      return {
        ok: false,
        error: "Agregá al menos una partida antes de aprobar.",
      };
    }

    const codeTaken = await prisma.project.findUnique({
      where: {
        organizationId_code: {
          organizationId: session.organizationId,
          code: proposal.code,
        },
      },
    });
    if (codeTaken) {
      return {
        ok: false,
        error: `Ya existe una obra con código ${proposal.code}. Cambiá el código del presupuesto o de la obra existente.`,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.user.id,
          clientId: proposal.clientId,
          code: proposal.code,
          name: proposal.name,
          city: proposal.city,
          address: proposal.address,
          description: proposal.description,
          status: "ACTIVE",
          currency: proposal.currency,
          members: {
            create: {
              userId: session.user.id,
              role: session.organizationRole,
            },
          },
        },
      });

      await tx.budget.create({
        data: {
          projectId: project.id,
          name: "Presupuesto Base",
          version: 1,
          status: "APPROVED",
          currency: proposal.currency,
          notes: proposal.notes,
          approvedAt: new Date(),
          items: {
            create: proposal.items.map((item, index) => ({
              code: item.code,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
              currency: item.currency,
              sortOrder: index,
            })),
          },
        },
      });

      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: "CONVERTED",
          convertedAt: new Date(),
          convertedProjectId: project.id,
        },
      });

      return project;
    });

    revalidateProposal(proposal.id);
    revalidatePath(`/projects/${result.id}`);
    revalidatePath(`/projects/${result.id}/budget`);
    return { ok: true, proposalId: proposal.id, projectId: result.id };
  } catch (error) {
    console.error("approveProposalAndCreateProject", error);
    return { ok: false, error: "No se pudo aprobar y crear la obra." };
  }
}
