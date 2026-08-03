"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { CertificationStatus, Prisma } from "@prisma/client";
import { round2, roundPct } from "@/features/certifications/lib/labels";

export type CertLineInput = {
  budgetItemId: string;
  currentPct: number;
};

export type ActionResult =
  | { ok: true; id?: string; number?: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateCerts(projectId: string, certId?: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/certifications`);
  revalidatePath(`/projects/${projectId}/budget`);
  if (certId) {
    revalidatePath(`/projects/${projectId}/certifications/${certId}`);
  }
}

async function assertProject(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

async function nextCertNumber(
  projectId: string,
  tx: Prisma.TransactionClient,
) {
  const last = await tx.certification.findFirst({
    where: { projectId, number: { startsWith: "CERT-" } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.replace("CERT-", "")) + 1 : 1;
  const safe = Number.isFinite(seq) && seq > 0 ? seq : 1;
  return `CERT-${String(safe).padStart(4, "0")}`;
}

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

async function buildLines(
  projectId: string,
  lines: CertLineInput[],
) {
  const budget = await prisma.budget.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    include: {
      items: {
        select: { id: true, totalCost: true },
      },
    },
  });
  if (!budget || budget.items.length === 0) {
    throw new Error("La obra necesita un presupuesto con partidas.");
  }

  const itemMap = new Map(
    budget.items.map((i) => [i.id, toNumber(i.totalCost)]),
  );

  const approvedItems = await prisma.certificationItem.findMany({
    where: {
      budgetItemId: { in: [...itemMap.keys()] },
      certification: {
        projectId,
        status: { in: ["SUBMITTED", "APPROVED", "PAID"] },
      },
    },
    select: { budgetItemId: true, currentPct: true },
  });
  const previousByItem = new Map<string, number>();
  for (const row of approvedItems) {
    const pct = toNumber(row.currentPct);
    const prev = previousByItem.get(row.budgetItemId) ?? 0;
    if (pct > prev) previousByItem.set(row.budgetItemId, pct);
  }

  const normalized = [];
  for (const line of lines) {
    if (!itemMap.has(line.budgetItemId)) {
      throw new Error("Una partida no pertenece al presupuesto de la obra.");
    }
    const previousPct = roundPct(previousByItem.get(line.budgetItemId) ?? 0);
    const currentPct = roundPct(Number(line.currentPct));
    if (Number.isNaN(currentPct) || currentPct < 0 || currentPct > 100) {
      throw new Error("El % acumulado debe estar entre 0 y 100.");
    }
    if (currentPct < previousPct) {
      throw new Error(
        `El % acumulado no puede ser menor al ya certificado (${previousPct}%).`,
      );
    }
    const periodPct = roundPct(currentPct - previousPct);
    if (periodPct <= 0) continue;

    const totalCost = itemMap.get(line.budgetItemId) ?? 0;
    const amount = round2((totalCost * periodPct) / 100);
    normalized.push({
      budgetItemId: line.budgetItemId,
      previousPct,
      currentPct,
      periodPct,
      amount,
    });
  }

  if (normalized.length === 0) {
    throw new Error(
      "Agregá al menos una partida con avance en el período (%>0).",
    );
  }

  return normalized;
}

function totalsFromLines(
  lines: { amount: number }[],
  retentionPct: number,
) {
  const grossAmount = round2(lines.reduce((a, l) => a + l.amount, 0));
  const pct = roundPct(Math.max(0, Math.min(100, retentionPct)));
  const retentionAmount = round2((grossAmount * pct) / 100);
  const netAmount = round2(grossAmount - retentionAmount);
  return { grossAmount, retentionPct: pct, retentionAmount, netAmount };
}

export async function createCertification(input: {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  retentionPct?: number;
  notes?: string;
  lines: CertLineInput[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso para certificar." };
    }

    await assertProject(input.projectId, session.organizationId);

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (
      Number.isNaN(periodStart.getTime()) ||
      Number.isNaN(periodEnd.getTime())
    ) {
      return { ok: false, error: "Período inválido." };
    }
    if (periodEnd < periodStart) {
      return { ok: false, error: "La fecha fin debe ser posterior al inicio." };
    }

    const lines = await buildLines(input.projectId, input.lines);
    const totals = totalsFromLines(lines, Number(input.retentionPct) || 0);

    const cert = await prisma.$transaction(async (tx) => {
      const number = await nextCertNumber(input.projectId, tx);
      return tx.certification.create({
        data: {
          projectId: input.projectId,
          number,
          periodStart,
          periodEnd,
          status: "DRAFT",
          notes: input.notes?.trim() || null,
          ...totals,
          items: {
            create: lines,
          },
        },
      });
    });

    revalidateCerts(input.projectId, cert.id);
    return { ok: true, id: cert.id, number: cert.number };
  } catch (error) {
    console.error("createCertification", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear la certificación.",
    };
  }
}

export async function updateCertification(input: {
  certificationId: string;
  periodStart: string;
  periodEnd: string;
  retentionPct?: number;
  notes?: string;
  lines: CertLineInput[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.certification.findFirst({
      where: {
        id: input.certificationId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Certificación no encontrada." };
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
      return {
        ok: false,
        error: "Solo se pueden editar borradores o rechazadas.",
      };
    }

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (periodEnd < periodStart) {
      return { ok: false, error: "La fecha fin debe ser posterior al inicio." };
    }

    const lines = await buildLines(existing.projectId, input.lines);
    const totals = totalsFromLines(lines, Number(input.retentionPct) || 0);

    await prisma.$transaction(async (tx) => {
      await tx.certificationItem.deleteMany({
        where: { certificationId: existing.id },
      });
      await tx.certification.update({
        where: { id: existing.id },
        data: {
          periodStart,
          periodEnd,
          notes: input.notes?.trim() || null,
          status: "DRAFT",
          submittedAt: null,
          approvedAt: null,
          paidAt: null,
          ...totals,
          items: { create: lines },
        },
      });
    });

    revalidateCerts(existing.projectId, existing.id);
    return { ok: true, id: existing.id, number: existing.number };
  } catch (error) {
    console.error("updateCertification", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la certificación.",
    };
  }
}

export async function setCertificationStatus(input: {
  certificationId: string;
  status: Extract<
    CertificationStatus,
    "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED"
  >;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.certification.findFirst({
      where: {
        id: input.certificationId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) return { ok: false, error: "Certificación no encontrada." };
    if (existing._count.items === 0 && input.status !== "DRAFT") {
      return { ok: false, error: "La certificación no tiene partidas." };
    }

    const now = new Date();
    const data: {
      status: CertificationStatus;
      submittedAt?: Date | null;
      approvedAt?: Date | null;
      paidAt?: Date | null;
    } = { status: input.status };

    if (input.status === "SUBMITTED") {
      data.submittedAt = now;
    }
    if (input.status === "APPROVED") {
      // Presentar confirma la certificación (quien la emite ya la da por válida).
      data.submittedAt = existing.submittedAt ?? now;
      data.approvedAt = now;
    }
    if (input.status === "PAID") {
      if (
        existing.status !== "APPROVED" &&
        existing.status !== "SUBMITTED" &&
        existing.status !== "PAID"
      ) {
        return {
          ok: false,
          error: "Solo se puede liquidar una certificación presentada.",
        };
      }
      data.submittedAt = existing.submittedAt ?? now;
      data.approvedAt = existing.approvedAt ?? now;
      data.paidAt = now;
    }
    if (input.status === "REJECTED") {
      data.approvedAt = null;
      data.paidAt = null;
    }
    if (input.status === "DRAFT") {
      data.submittedAt = null;
      data.approvedAt = null;
      data.paidAt = null;
    }

    await prisma.certification.update({
      where: { id: existing.id },
      data,
    });

    revalidateCerts(existing.projectId, existing.id);
    return { ok: true, id: existing.id, number: existing.number };
  } catch (error) {
    console.error("setCertificationStatus", error);
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

export async function deleteCertification(
  certificationId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.certification.findFirst({
      where: {
        id: certificationId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Certificación no encontrada." };
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
      return {
        ok: false,
        error: "Solo se pueden eliminar borradores o rechazadas.",
      };
    }

    await prisma.certification.delete({ where: { id: existing.id } });
    revalidateCerts(existing.projectId);
    return { ok: true, id: existing.id, number: existing.number };
  } catch (error) {
    console.error("deleteCertification", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}
