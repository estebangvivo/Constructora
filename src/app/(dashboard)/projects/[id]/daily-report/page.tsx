import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import type { ProjectRouteParams } from "@/types";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listDailyReports } from "@/features/daily-report/queries/list-daily-reports";
import { WEATHER_LABEL } from "@/features/daily-report/lib/labels";
import { formatDateAR } from "@/lib/format-date";

export default async function DailyReportPage({ params }: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const reports = await listDailyReports(id);
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">Parte Diario</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal, clima, máquinas, avances e incidencias — cada captura con
            notas libres.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/projects/${id}/daily-report/new`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
          >
            <Plus className="size-4" aria-hidden />
            Nuevo parte
          </Link>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay partes diarios. Creá el primero para registrar el día
          de obra.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/projects/${id}/daily-report/${report.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {formatDateAR(report.reportDate)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {report.weather
                      ? WEATHER_LABEL[report.weather]
                      : "Sin clima"}
                    {report.authorName ? ` · ${report.authorName}` : ""}
                    {report.notes
                      ? ` · ${report.notes.slice(0, 60)}${report.notes.length > 60 ? "…" : ""}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">
                      {report.workforceCount}
                    </strong>{" "}
                    personas
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {report.equipmentHours}h
                    </strong>{" "}
                    máquina
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {report.advanceCount}
                    </strong>{" "}
                    avances
                  </span>
                  <span
                    className={
                      report.incidentCount > 0
                        ? "text-warning"
                        : "text-muted-foreground"
                    }
                  >
                    <strong>{report.incidentCount}</strong> incidencias
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
