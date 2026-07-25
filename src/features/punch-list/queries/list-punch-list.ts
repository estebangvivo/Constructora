import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { PunchListPriority, PunchListStatus } from "@prisma/client";

export type PunchListMember = {
  id: string;
  name: string;
};

export type PunchListRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  status: PunchListStatus;
  priority: PunchListPriority;
  photoUrls: string[];
  dueDate: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  assigneeId: string | null;
  assigneeName: string | null;
  createdByName: string | null;
};

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
} | null) {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

async function assertProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
}

export async function listPunchListItems(
  projectId: string,
  statusFilter?: PunchListStatus | "ALL",
): Promise<PunchListRow[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const rows = await prisma.punchListItem.findMany({
    where: {
      projectId,
      ...(statusFilter && statusFilter !== "ALL"
        ? { status: statusFilter }
        : {}),
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      assignee: {
        select: { firstName: true, lastName: true, email: true },
      },
      createdBy: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    status: r.status,
    priority: r.priority,
    photoUrls: r.photoUrls,
    dueDate: r.dueDate,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
    assigneeId: r.assigneeId,
    assigneeName: displayName(r.assignee),
    createdByName: displayName(r.createdBy),
  }));
}

export async function getPunchListItem(
  itemId: string,
): Promise<(PunchListRow & { projectId: string }) | null> {
  const session = await requireSession();
  const row = await prisma.punchListItem.findFirst({
    where: {
      id: itemId,
      project: {
        organizationId: session.organizationId,
        deletedAt: null,
      },
    },
    include: {
      assignee: {
        select: { firstName: true, lastName: true, email: true },
      },
      createdBy: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    location: row.location,
    status: row.status,
    priority: row.priority,
    photoUrls: row.photoUrls,
    dueDate: row.dueDate,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    assigneeId: row.assigneeId,
    assigneeName: displayName(row.assignee),
    createdByName: displayName(row.createdBy),
  };
}

/** Miembros de la obra + org para asignar observaciones. */
export async function listPunchAssignees(
  projectId: string,
): Promise<PunchListMember[]> {
  const session = await requireSession();
  const project = await assertProject(projectId, session.organizationId);
  if (!project) return [];

  const [projectMembers, orgMembers] = await Promise.all([
    prisma.projectMembership.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: session.organizationId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
  ]);

  const map = new Map<string, PunchListMember>();
  for (const m of [...projectMembers, ...orgMembers]) {
    map.set(m.user.id, {
      id: m.user.id,
      name: displayName(m.user) ?? m.user.email,
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
