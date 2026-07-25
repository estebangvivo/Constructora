import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { PunchListPriority, WeatherCondition } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

export type DailyReportListItem = {
  id: string;
  reportDate: Date;
  weather: WeatherCondition | null;
  temperature: number | null;
  notes: string | null;
  workforceCount: number;
  equipmentHours: number;
  advanceCount: number;
  incidentCount: number;
  authorName: string | null;
};

export type DailyReportDetail = {
  id: string;
  projectId: string;
  reportDate: Date;
  weather: WeatherCondition | null;
  temperature: number | null;
  notes: string | null;
  weatherNotes: string | null;
  workforceNotes: string | null;
  equipmentNotes: string | null;
  advanceNotes: string | null;
  incidentNotes: string | null;
  workforce: {
    id: string;
    workerName: string;
    roleOrTrade: string | null;
    companyName: string | null;
    hoursWorked: number;
    notes: string | null;
  }[];
  equipment: {
    id: string;
    equipmentName: string;
    hoursUsed: number;
    operatorName: string | null;
    notes: string | null;
  }[];
  advances: {
    id: string;
    description: string;
    quantity: number;
    unit: string | null;
    notes: string | null;
  }[];
  incidents: {
    id: string;
    title: string;
    description: string | null;
    notes: string | null;
    severity: PunchListPriority;
  }[];
};

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
}

export async function listDailyReports(
  projectId: string,
): Promise<DailyReportListItem[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.dailyReport.findMany({
    where: { projectId },
    orderBy: { reportDate: "desc" },
    include: {
      author: { select: { firstName: true, lastName: true, email: true } },
      workforce: { select: { id: true } },
      equipment: { select: { hoursUsed: true } },
      advances: { select: { id: true } },
      incidents: { select: { id: true } },
    },
  });

  return rows.map((r) => {
    const authorName = [r.author?.firstName, r.author?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      id: r.id,
      reportDate: r.reportDate,
      weather: r.weather,
      temperature: toNumber(r.temperature),
      notes: r.notes,
      workforceCount: r.workforce.length,
      equipmentHours: r.equipment.reduce(
        (a, e) => a + (toNumber(e.hoursUsed) ?? 0),
        0,
      ),
      advanceCount: r.advances.length,
      incidentCount: r.incidents.length,
      authorName: authorName || r.author?.email || null,
    };
  });
}

export async function getDailyReportById(
  reportId: string,
): Promise<DailyReportDetail | null> {
  const session = await requireSession();
  const row = await prisma.dailyReport.findFirst({
    where: {
      id: reportId,
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
      },
    },
    include: {
      workforce: { orderBy: { workerName: "asc" } },
      equipment: { orderBy: { equipmentName: "asc" } },
      advances: { orderBy: { description: "asc" } },
      incidents: { orderBy: { title: "asc" } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    reportDate: row.reportDate,
    weather: row.weather,
    temperature: toNumber(row.temperature),
    notes: row.notes,
    weatherNotes: row.weatherNotes,
    workforceNotes: row.workforceNotes,
    equipmentNotes: row.equipmentNotes,
    advanceNotes: row.advanceNotes,
    incidentNotes: row.incidentNotes,
    workforce: row.workforce.map((w) => ({
      id: w.id,
      workerName: w.workerName,
      roleOrTrade: w.roleOrTrade,
      companyName: w.companyName,
      hoursWorked: toNumber(w.hoursWorked) ?? 0,
      notes: w.notes,
    })),
    equipment: row.equipment.map((e) => ({
      id: e.id,
      equipmentName: e.equipmentName,
      hoursUsed: toNumber(e.hoursUsed) ?? 0,
      operatorName: e.operatorName,
      notes: e.notes,
    })),
    advances: row.advances.map((a) => ({
      id: a.id,
      description: a.description,
      quantity: toNumber(a.quantity) ?? 0,
      unit: a.unit,
      notes: a.notes,
    })),
    incidents: row.incidents.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      notes: i.notes,
      severity: i.severity,
    })),
  };
}
