import {
  CERT_STATUS_LABEL,
  formatCertMoney,
} from "@/features/certifications/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import type { CertificationStatus } from "@prisma/client";

export type CertificationPrintData = {
  number: string;
  status: CertificationStatus;
  periodStart: Date | string;
  periodEnd: Date | string;
  currency: string;
  grossAmount: number;
  retentionPct: number;
  retentionAmount: number;
  netAmount: number;
  collectedAmount: number;
  notes?: string | null;
  projectCode: string;
  projectName: string;
  projectAddress?: string | null;
  clientName?: string | null;
  clientTaxId?: string | null;
  organizationName: string;
  organizationTaxId?: string | null;
  organizationAddress?: string | null;
  organizationLogoUrl?: string | null;
  items: {
    code: string;
    description: string;
    previousPct: number;
    currentPct: number;
    periodPct: number;
    amount: number;
  }[];
};

export function CertificationPrintReport({
  data,
}: {
  data: CertificationPrintData;
}) {
  const logoSrc = data.organizationLogoUrl?.split("?")[0] ?? null;
  const balance =
    Math.round((data.netAmount - data.collectedAmount) * 100) / 100;

  return (
    <article className="mx-auto max-w-3xl bg-white px-6 py-8 text-[#1c1917] shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
      <header className="flex items-start gap-4 border-b border-[#d6d3d1] pb-5">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt=""
            className="h-14 w-auto max-w-[140px] object-contain"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl tracking-tight">
            {data.organizationName}
          </p>
          {data.organizationTaxId ? (
            <p className="mt-0.5 text-sm text-[#78716c]">
              CUIT: {data.organizationTaxId}
            </p>
          ) : null}
          {data.organizationAddress ? (
            <p className="mt-0.5 text-sm text-[#78716c]">
              {data.organizationAddress}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#78716c]">
            Certificación de obra
          </p>
          <h1 className="font-display text-2xl tracking-tight">{data.number}</h1>
          <p className="mt-1 text-sm text-[#78716c]">
            Período {formatDateAR(data.periodStart)} →{" "}
            {formatDateAR(data.periodEnd)}
          </p>
        </div>
        <p className="rounded border border-[#d6d3d1] px-2 py-1 text-sm">
          {CERT_STATUS_LABEL[data.status]}
        </p>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-[#78716c]">Obra</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {data.projectCode} · {data.projectName}
          </dd>
          {data.projectAddress ? (
            <dd className="text-sm text-[#78716c]">{data.projectAddress}</dd>
          ) : null}
        </div>
        {data.clientName ? (
          <div>
            <dt className="text-xs uppercase text-[#78716c]">Cliente</dt>
            <dd className="mt-0.5 text-sm font-medium">{data.clientName}</dd>
            {data.clientTaxId ? (
              <dd className="text-sm text-[#78716c]">CUIT: {data.clientTaxId}</dd>
            ) : null}
          </div>
        ) : null}
      </dl>

      <dl className="mt-6 grid gap-3 border-y border-[#d6d3d1] py-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase text-[#78716c]">Bruto</dt>
          <dd className="font-display text-lg">
            {formatCertMoney(data.grossAmount, data.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[#78716c]">
            Retención ({data.retentionPct}%)
          </dt>
          <dd className="font-display text-lg">
            {formatCertMoney(data.retentionAmount, data.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[#78716c]">Neto</dt>
          <dd className="font-display text-lg">
            {formatCertMoney(data.netAmount, data.currency)}
          </dd>
        </div>
      </dl>

      {(data.collectedAmount > 0 || balance < data.netAmount) && (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-[#78716c]">Cobrado</dt>
            <dd className="text-sm font-medium">
              {formatCertMoney(data.collectedAmount, data.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[#78716c]">Saldo</dt>
            <dd className="text-sm font-medium">
              {formatCertMoney(balance, data.currency)}
            </dd>
          </div>
        </dl>
      )}

      {data.notes ? (
        <p className="mt-4 text-sm text-[#57534e]">Notas: {data.notes}</p>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#d6d3d1] text-xs uppercase text-[#78716c]">
              <th className="py-2 pr-3 font-medium">Código</th>
              <th className="py-2 pr-3 font-medium">Descripción</th>
              <th className="py-2 pr-3 text-right font-medium">Ant.</th>
              <th className="py-2 pr-3 text-right font-medium">Acum.</th>
              <th className="py-2 pr-3 text-right font-medium">Período</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={`${item.code}-${item.description}`} className="border-b border-[#e7e5e4]">
                <td className="py-2.5 pr-3 font-mono text-xs">{item.code}</td>
                <td className="py-2.5 pr-3">{item.description}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-[#78716c]">
                  {item.previousPct}%
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {item.currentPct}%
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {item.periodPct}%
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium">
                  {formatCertMoney(item.amount, data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-xs text-[#a8a29e]">
        Documento generado para el cliente. No constituye factura fiscal.
      </p>
    </article>
  );
}
