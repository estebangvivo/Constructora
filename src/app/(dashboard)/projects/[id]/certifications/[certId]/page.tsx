import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import {
  getCertificationById,
  listCertifiableBudgetItems,
} from "@/features/certifications/queries/list-certifications";
import { CertificationActions } from "@/features/certifications/components/certification-actions";
import { CertificationForm } from "@/features/certifications/components/certification-form";
import {
  CERT_STATUS_LABEL,
  CERT_STATUS_STYLE,
  formatCertMoney,
} from "@/features/certifications/lib/labels";
import { formatDateAR, toDateInputValue } from "@/lib/format-date";

type PageProps = {
  params: Promise<{ id: string; certId: string }>;
};

export default async function CertificationDetailPage({ params }: PageProps) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id: projectId, certId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const cert = await getCertificationById(certId);
  if (!cert || cert.projectId !== projectId) notFound();

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );
  const editable =
    canManage && (cert.status === "DRAFT" || cert.status === "REJECTED");

  if (editable) {
    const budgetItems = await listCertifiableBudgetItems(projectId);
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/projects/${projectId}/certifications`}
                className="hover:text-foreground"
              >
                Certificaciones
              </Link>
            </p>
            <h2 className="font-display text-xl tracking-tight">
              {cert.number}{" "}
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CERT_STATUS_STYLE[cert.status]}`}
              >
                {CERT_STATUS_LABEL[cert.status]}
              </span>
            </h2>
          </div>
          <CertificationActions
            certificationId={cert.id}
            projectId={projectId}
            status={cert.status}
            canManage={canManage}
          />
        </div>
        <CertificationForm
          projectId={projectId}
          currency={cert.currency}
          budgetItems={budgetItems}
          mode="edit"
          certificationId={cert.id}
          initial={{
            periodStart: toDateInputValue(cert.periodStart),
            periodEnd: toDateInputValue(cert.periodEnd),
            retentionPct: cert.retentionPct,
            notes: cert.notes ?? "",
            lines: cert.items.map((i) => ({
              budgetItemId: i.budgetItemId,
              currentPct: i.currentPct,
            })),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/projects/${projectId}/certifications`}
              className="hover:text-foreground"
            >
              Certificaciones
            </Link>
          </p>
          <h2 className="font-display text-xl tracking-tight">
            {cert.number}{" "}
            <span
              className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${CERT_STATUS_STYLE[cert.status]}`}
            >
              {CERT_STATUS_LABEL[cert.status]}
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateAR(cert.periodStart)} → {formatDateAR(cert.periodEnd)}
          </p>
        </div>
        <CertificationActions
          certificationId={cert.id}
          projectId={projectId}
          status={cert.status}
          canManage={canManage}
        />
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Bruto</dt>
          <dd className="font-display text-xl">
            {formatCertMoney(cert.grossAmount, cert.currency)}
          </dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase text-muted-foreground">
            Retención ({cert.retentionPct}%)
          </dt>
          <dd className="font-display text-xl">
            {formatCertMoney(cert.retentionAmount, cert.currency)}
          </dd>
        </div>
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Neto</dt>
          <dd className="font-display text-xl">
            {formatCertMoney(cert.netAmount, cert.currency)}
          </dd>
        </div>
      </dl>

      {cert.notes && (
        <p className="text-sm text-muted-foreground">Notas: {cert.notes}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Código</th>
              <th className="py-2 pr-3 font-medium">Descripción</th>
              <th className="py-2 pr-3 text-right font-medium">Ant.</th>
              <th className="py-2 pr-3 text-right font-medium">Acum.</th>
              <th className="py-2 pr-3 text-right font-medium">Período</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cert.items.map((item) => (
              <tr key={item.id} className="border-b border-border/70">
                <td className="py-3 pr-3 font-mono text-xs">{item.code}</td>
                <td className="py-3 pr-3">{item.description}</td>
                <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground">
                  {item.previousPct}%
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">
                  {item.currentPct}%
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">
                  {item.periodPct}%
                </td>
                <td className="py-3 text-right tabular-nums font-medium">
                  {formatCertMoney(item.amount, cert.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
