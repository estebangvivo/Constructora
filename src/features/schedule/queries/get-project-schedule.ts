import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { TaskStatus } from "@prisma/client";

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type ScheduleTask = {
  id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  progressPct: number;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  sortOrder: number;
  milestoneId: string | null;
  predecessorId: string | null;
  predecessorName: string | null;
};

export type ScheduleMilestone = {
  id: string;
  name: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  sortOrder: number;
};

export type ProjectSchedule = {
  projectId: string;
  projectStart: Date | null;
  projectEnd: Date | null;
  milestones: ScheduleMilestone[];
  tasks: ScheduleTask[];
};

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true, startDate: true, endDate: true },
  });
}

export async function getProjectSchedule(
  projectId: string,
): Promise<ProjectSchedule | null> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return null;

  const [milestones, tasks] = await Promise.all([
    prisma.milestone.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }, { name: "asc" }],
    }),
    prisma.task.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { plannedStart: "asc" }, { name: "asc" }],
      include: {
        predecessor: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    projectId,
    projectStart: project.startDate,
    projectEnd: project.endDate,
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      dueDate: m.dueDate,
      completedAt: m.completedAt,
      sortOrder: m.sortOrder,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      status: t.status,
      progressPct: toNumber(t.progressPct),
      plannedStart: t.plannedStart,
      plannedEnd: t.plannedEnd,
      actualStart: t.actualStart,
      actualEnd: t.actualEnd,
      sortOrder: t.sortOrder,
      milestoneId: t.milestoneId,
      predecessorId: t.predecessorId,
      predecessorName: t.predecessor?.name ?? null,
    })),
  };
}
