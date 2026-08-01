import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listProjectCertifications } from "@/features/certifications/queries/list-certifications";
import {
  CERT_STATUS_LABEL,
  CERT_STATUS_STYLE,
  formatCertMoney,
} from "@/features/certifications/lib/labels";
import { formatDateAR } from "@/lib/format-date";

export default async function CertificationsPage({
  params,
}: ProjectRouteParams) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const certifications = await listProjectCertifications(id);
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );
  const currency = project.currency ?? "ARS";

  const approvedNet = certifications
    .filter((c) => c.status === "APPROVED" || c.status === "PAID")
    .reduce((a, c) => a + c.netAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">
            Certificaciones
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Documentos internos de avance de obra (sin facturación ARCA).
          </p>
        </div>
        {canManage && (
          <Link
            href={`/projects/${id}/certifications/new`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
          >
            <Plus className="size-4" aria-hidden />
            Nueva certificación
          </Link>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Neto aprobado / liquidado
          </dt>
          <dd className="mt-1 font-display text-xl">
            {formatCertMoney(approvedNet, currency)}
          </dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Documentos
          </dt>
          <dd className="mt-1 font-display text-xl">{certifications.length}</dd>
        </div>
      </dl>

      {certifications.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay certificaciones. Creá la primera para documentar el
          avance.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {certifications.map((item) => (
            <li key={item.id}>
              <Link
                href={`/projects/${id}/certifications/${item.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {item.number}{" "}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CERT_STATUS_STYLE[item.status]}`}
                    >
                      {CERT_STATUS_LABEL[item.status]}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateAR(item.periodStart)} →{" "}
                    {formatDateAR(item.periodEnd)} ·{" "}
                    {item.itemCount} partida
                    {item.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-medium tabular-nums">
                    Neto {formatCertMoney(item.netAmount, currency)}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Bruto {formatCertMoney(item.grossAmount, currency)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
