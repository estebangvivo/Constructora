import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import {
  listPunchAssignees,
  listPunchListItems,
} from "@/features/punch-list/queries/list-punch-list";
import { PunchListBoard } from "@/features/punch-list/components/punch-list-board";

export default async function PunchListPage({ params }: ProjectRouteParams) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const [items, assignees] = await Promise.all([
    listPunchListItems(id),
    listPunchAssignees(id),
  ]);

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  return (
    <PunchListBoard
      projectId={id}
      items={items}
      assignees={assignees}
      canManage={canManage}
    />
  );
}
