import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { getProjectSchedule } from "@/features/schedule/queries/get-project-schedule";
import { ScheduleBoard } from "@/features/schedule/components/schedule-board";

export default async function SchedulePage({ params }: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const schedule = await getProjectSchedule(id);
  if (!schedule) notFound();

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  return <ScheduleBoard schedule={schedule} canManage={canManage} />;
}
