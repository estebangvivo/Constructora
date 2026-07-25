"use server";

import { revalidatePath } from "next/cache";
import type { PunchListPriority, WeatherCondition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { parseLocalDate } from "@/features/schedule/lib/gantt-range";
import {
  SEVERITY_OPTIONS,
  WEATHER_OPTIONS,
} from "@/features/daily-report/lib/labels";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type WorkforceInput = {
  workerName: string;
  roleOrTrade?: string;
  companyName?: string;
  hoursWorked: number;
  notes?: string;
};

export type EquipmentInput = {
  equipmentName: string;
  hoursUsed: number;
  operatorName?: string;
  notes?: string;
};

export type AdvanceInput = {
  description: string;
  quantity: number;
  unit?: string;
  notes?: string;
};

export type IncidentInput = {
  title: string;
  description?: string;
  notes?: string;
  severity: PunchListPriority;
};

export type DailyReportPayload = {
  projectId: string;
  reportDate: string;
  weather?: WeatherCondition | "";
  temperature?: number | null;
  notes?: string;
  weatherNotes?: string;
  workforceNotes?: string;
  equipmentNotes?: string;
  advanceNotes?: string;
  incidentNotes?: string;
  workforce: WorkforceInput[];
  equipment: EquipmentInput[];
  advances: AdvanceInput[];
  incidents: IncidentInput[];
};

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateReports(projectId: string, reportId?: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/daily-report`);
  if (reportId) {
    revalidatePath(`/projects/${projectId}/daily-report/${reportId}`);
  }
}

function emptyToNull(value?: string | null) {
  const t = value?.trim();
  return t ? t : null;
}

function parseWeather(value?: string | null): WeatherCondition | null {
  if (!value) return null;
  return WEATHER_OPTIONS.includes(value as WeatherCondition)
    ? (value as WeatherCondition)
    : null;
}

function parseSeverity(value?: string | null): PunchListPriority {
  if (value && SEVERITY_OPTIONS.includes(value as PunchListPriority)) {
    return value as PunchListPriority;
  }
  return "MEDIUM";
}

async function assertProject(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new Error("Obra no encontrada.");
  return project;
}

function normalizePayload(input: DailyReportPayload) {
  const reportDate = parseLocalDate(input.reportDate);
  if (!reportDate) throw new Error("Fecha inválida.");

  const workforce = input.workforce
    .map((w) => ({
      workerName: w.workerName.trim(),
      roleOrTrade: emptyToNull(w.roleOrTrade),
      companyName: emptyToNull(w.companyName),
      hoursWorked: Number(w.hoursWorked) || 0,
      notes: emptyToNull(w.notes),
    }))
    .filter((w) => w.workerName.length > 0);

  const equipment = input.equipment
    .map((e) => ({
      equipmentName: e.equipmentName.trim(),
      hoursUsed: Number(e.hoursUsed) || 0,
      operatorName: emptyToNull(e.operatorName),
      notes: emptyToNull(e.notes),
    }))
    .filter((e) => e.equipmentName.length > 0);

  const advances = input.advances
    .map((a) => ({
      description: a.description.trim(),
      quantity: Number(a.quantity) || 0,
      unit: emptyToNull(a.unit),
      notes: emptyToNull(a.notes),
    }))
    .filter((a) => a.description.length > 0);

  const incidents = input.incidents
    .map((i) => ({
      title: i.title.trim(),
      description: emptyToNull(i.description),
      notes: emptyToNull(i.notes),
      severity: parseSeverity(i.severity),
    }))
    .filter((i) => i.title.length > 0);

  const temperature =
    input.temperature == null || input.temperature === ("" as unknown)
      ? null
      : Number(input.temperature);

  return {
    reportDate,
    weather: parseWeather(input.weather),
    temperature:
      temperature != null && Number.isFinite(temperature) ? temperature : null,
    notes: emptyToNull(input.notes),
    weatherNotes: emptyToNull(input.weatherNotes),
    workforceNotes: emptyToNull(input.workforceNotes),
    equipmentNotes: emptyToNull(input.equipmentNotes),
    advanceNotes: emptyToNull(input.advanceNotes),
    incidentNotes: emptyToNull(input.incidentNotes),
    workforce,
    equipment,
    advances,
    incidents,
  };
}

export async function createDailyReport(
  input: DailyReportPayload,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }
    await assertProject(input.projectId, session.organizationId);
    const data = normalizePayload(input);

    const clash = await prisma.dailyReport.findFirst({
      where: {
        projectId: input.projectId,
        reportDate: data.reportDate,
      },
    });
    if (clash) {
      return {
        ok: false,
        error: "Ya existe un parte para esa fecha. Abrilo para editarlo.",
      };
    }

    const report = await prisma.dailyReport.create({
      data: {
        projectId: input.projectId,
        authorId: session.user.id,
        reportDate: data.reportDate,
        weather: data.weather,
        temperature: data.temperature,
        notes: data.notes,
        weatherNotes: data.weatherNotes,
        workforceNotes: data.workforceNotes,
        equipmentNotes: data.equipmentNotes,
        advanceNotes: data.advanceNotes,
        incidentNotes: data.incidentNotes,
        syncedAt: new Date(),
        workforce: { create: data.workforce },
        equipment: { create: data.equipment },
        advances: { create: data.advances },
        incidents: { create: data.incidents },
      },
    });

    revalidateReports(input.projectId, report.id);
    return { ok: true, id: report.id };
  } catch (error) {
    console.error("createDailyReport", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo crear el parte.",
    };
  }
}

export async function updateDailyReport(
  reportId: string,
  input: DailyReportPayload,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.dailyReport.findFirst({
      where: {
        id: reportId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Parte no encontrado." };

    const data = normalizePayload({ ...input, projectId: existing.projectId });

    const clash = await prisma.dailyReport.findFirst({
      where: {
        projectId: existing.projectId,
        reportDate: data.reportDate,
        NOT: { id: existing.id },
      },
    });
    if (clash) {
      return { ok: false, error: "Ya existe otro parte para esa fecha." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.dailyReportWorkforce.deleteMany({
        where: { dailyReportId: existing.id },
      });
      await tx.dailyReportEquipment.deleteMany({
        where: { dailyReportId: existing.id },
      });
      await tx.dailyReportAdvance.deleteMany({
        where: { dailyReportId: existing.id },
      });
      await tx.dailyReportIncident.deleteMany({
        where: { dailyReportId: existing.id },
      });

      await tx.dailyReport.update({
        where: { id: existing.id },
        data: {
          reportDate: data.reportDate,
          weather: data.weather,
          temperature: data.temperature,
          notes: data.notes,
          weatherNotes: data.weatherNotes,
          workforceNotes: data.workforceNotes,
          equipmentNotes: data.equipmentNotes,
          advanceNotes: data.advanceNotes,
          incidentNotes: data.incidentNotes,
          syncedAt: new Date(),
          workforce: { create: data.workforce },
          equipment: { create: data.equipment },
          advances: { create: data.advances },
          incidents: { create: data.incidents },
        },
      });
    });

    revalidateReports(existing.projectId, existing.id);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("updateDailyReport", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el parte.",
    };
  }
}

export async function deleteDailyReport(
  reportId: string,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const existing = await prisma.dailyReport.findFirst({
      where: {
        id: reportId,
        project: {
          organizationId: session.organizationId,
          deletedAt: null,
        },
      },
    });
    if (!existing) return { ok: false, error: "Parte no encontrado." };

    await prisma.dailyReport.delete({ where: { id: existing.id } });
    revalidateReports(existing.projectId);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("deleteDailyReport", error);
    return { ok: false, error: "No se pudo eliminar." };
  }
}
