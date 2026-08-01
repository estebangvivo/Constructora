import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { getDailyReportById } from "@/features/daily-report/queries/list-daily-reports";
import { DailyReportForm } from "@/features/daily-report/components/daily-report-form";
import {
  SEVERITY_LABEL,
  SEVERITY_STYLE,
  WEATHER_LABEL,
} from "@/features/daily-report/lib/labels";
import { formatDateAR } from "@/lib/format-date";

type PageProps = {
  params: Promise<{ id: string; reportId: string }>;
};

export default async function DailyReportDetailPage({ params }: PageProps) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id: projectId, reportId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const report = await getDailyReportById(reportId);
  if (!report || report.projectId !== projectId) notFound();

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  if (canManage) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/projects/${projectId}/daily-report`}
              className="hover:text-foreground"
            >
              Parte Diario
            </Link>
          </p>
          <h2 className="font-display text-xl tracking-tight">
            Parte {formatDateAR(report.reportDate)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Editá capturas y notas de cada sección.
          </p>
        </div>
        <DailyReportForm projectId={projectId} initial={report} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/projects/${projectId}/daily-report`}
            className="hover:text-foreground"
          >
            Parte Diario
          </Link>
        </p>
        <h2 className="font-display text-xl tracking-tight">
          Parte {formatDateAR(report.reportDate)}
        </h2>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Clima</dt>
          <dd>
            {report.weather ? WEATHER_LABEL[report.weather] : "—"}
            {report.temperature != null ? ` · ${report.temperature}°C` : ""}
          </dd>
          {report.weatherNotes && (
            <dd className="mt-1 text-sm text-muted-foreground">
              {report.weatherNotes}
            </dd>
          )}
        </div>
        {report.notes && (
          <div>
            <dt className="text-xs uppercase text-muted-foreground">
              Notas generales
            </dt>
            <dd>{report.notes}</dd>
          </div>
        )}
      </dl>

      <section className="space-y-2">
        <h3 className="font-medium">Personal</h3>
        {report.workforceNotes && (
          <p className="text-sm text-muted-foreground">{report.workforceNotes}</p>
        )}
        <ul className="divide-y divide-border border-y border-border text-sm">
          {report.workforce.map((w) => (
            <li key={w.id} className="py-2">
              <p className="font-medium">
                {w.workerName}
                {w.roleOrTrade ? ` · ${w.roleOrTrade}` : ""} · {w.hoursWorked}h
              </p>
              {w.notes && (
                <p className="text-muted-foreground">{w.notes}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Máquinas</h3>
        {report.equipmentNotes && (
          <p className="text-sm text-muted-foreground">{report.equipmentNotes}</p>
        )}
        <ul className="divide-y divide-border border-y border-border text-sm">
          {report.equipment.map((e) => (
            <li key={e.id} className="py-2">
              <p className="font-medium">
                {e.equipmentName} · {e.hoursUsed}h
              </p>
              {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Avances</h3>
        {report.advanceNotes && (
          <p className="text-sm text-muted-foreground">{report.advanceNotes}</p>
        )}
        <ul className="divide-y divide-border border-y border-border text-sm">
          {report.advances.map((a) => (
            <li key={a.id} className="py-2">
              <p className="font-medium">
                {a.description} · {a.quantity}
                {a.unit ? ` ${a.unit}` : ""}
              </p>
              {a.notes && <p className="text-muted-foreground">{a.notes}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Incidencias</h3>
        {report.incidentNotes && (
          <p className="text-sm text-muted-foreground">{report.incidentNotes}</p>
        )}
        <ul className="divide-y divide-border border-y border-border text-sm">
          {report.incidents.map((i) => (
            <li key={i.id} className="py-2">
              <p className="font-medium">
                {i.title}{" "}
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-xs ${SEVERITY_STYLE[i.severity]}`}
                >
                  {SEVERITY_LABEL[i.severity]}
                </span>
              </p>
              {i.description && (
                <p className="text-muted-foreground">{i.description}</p>
              )}
              {i.notes && <p className="text-muted-foreground">{i.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
