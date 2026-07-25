import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { DailyReportForm } from "@/features/daily-report/components/daily-report-form";

export default async function NewDailyReportPage({
  params,
}: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  if (!["ADMIN", "DIRECTOR", "RESIDENT"].includes(session.organizationRole)) {
    redirect("/");
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/projects/${id}/daily-report`}
            className="hover:text-foreground"
          >
            Parte Diario
          </Link>
        </p>
        <h2 className="font-display text-xl tracking-tight">Nuevo parte</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Completá cada captura. Todas tienen espacio de notas en texto libre.
        </p>
      </div>
      <DailyReportForm projectId={id} />
    </div>
  );
}
