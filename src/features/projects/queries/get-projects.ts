import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { ProjectStatus } from "@prisma/client";

export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: ProjectStatus;
  clientName: string | null;
  /** Avance promedio de tareas; 0 si no hay cronograma. */
  progressPct: number;
};

function averageProgress(
  tasks: { progressPct: { toNumber(): number } | number }[],
): number {
  if (tasks.length === 0) return 0;
  const sum = tasks.reduce((acc, t) => {
    const value =
      typeof t.progressPct === "number"
        ? t.progressPct
        : t.progressPct.toNumber();
    return acc + value;
  }, 0);
  return Math.round(sum / tasks.length);
}

/** Lista obras de la organización del usuario autenticado. */
export async function listProjects(): Promise<ProjectListItem[]> {
  const session = await requireSession();

  const projects = await prisma.project.findMany({
    where: {
      organizationId: session.organizationId,
      deletedAt: null,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      client: { select: { name: true } },
      tasks: {
        select: { progressPct: true },
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    code: project.code,
    name: project.name,
    city: project.city,
    status: project.status,
    clientName: project.client?.name ?? null,
    progressPct: averageProgress(project.tasks),
  }));
}

export type ProjectSummary = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: ProjectStatus;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  currency: string;
};

/** Obtiene una obra si pertenece a la org del usuario. */
export async function getProjectById(
  projectId: string,
): Promise<ProjectSummary | null> {
  const session = await requireSession();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      status: true,
      description: true,
      clientId: true,
      currency: true,
      client: { select: { name: true } },
    },
  });

  if (!project) return null;

  return {
    id: project.id,
    code: project.code,
    name: project.name,
    city: project.city,
    status: project.status,
    description: project.description,
    clientId: project.clientId,
    clientName: project.client?.name ?? null,
    currency: project.currency,
  };
}
