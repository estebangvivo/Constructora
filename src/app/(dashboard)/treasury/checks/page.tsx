import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listChecks } from "@/features/treasury/queries/list-checks";
import {
  CHECK_STATUS_LABEL,
  CHECK_STATUS_STYLE,
  formatMoney,
} from "@/features/treasury/lib/labels";
import type { CheckStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

const FILTERS: { value: CheckStatus | "ALL"; label: string }[] = [
  { value: "IN_PORTFOLIO", label: "En cartera" },
  { value: "DELIVERED", label: "Entregados" },
  { value: "ALL", label: "Todos" },
  { value: "CANCELLED", label: "Anulados" },
];

function parseStatus(raw?: string): CheckStatus | "ALL" {
  if (
    raw === "ALL" ||
    raw === "IN_PORTFOLIO" ||
    raw === "DELIVERED" ||
    raw === "CANCELLED"
  ) {
    return raw;
  }
  return "IN_PORTFOLIO";
}

export default async function ChecksPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { status: statusParam } = await searchParams;
  const status = parseStatus(statusParam);
  const checks = await listChecks({ status });

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/treasury" className="hover:text-foreground">
            Tesorería
          </Link>
        </p>
        <h1 className="font-display text-3xl tracking-tight">
          Cheques en cartera
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entran al imputar un recibo con cheque. Salen al imputar una orden de
          pago que los use.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = status === f.value;
          const href =
            f.value === "IN_PORTFOLIO"
              ? "/treasury/checks"
              : `/treasury/checks?status=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={
                active
                  ? "rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm text-background"
                  : "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {checks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {status === "IN_PORTFOLIO"
            ? "No hay cheques disponibles en cartera."
            : "No hay cheques con este filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3 font-medium">N°</th>
                <th className="py-3 pr-3 font-medium">Banco</th>
                <th className="py-3 pr-3 font-medium">Monto</th>
                <th className="py-3 pr-3 font-medium">Vencimiento</th>
                <th className="py-3 pr-3 font-medium">Librador</th>
                <th className="py-3 pr-3 font-medium">Estado</th>
                <th className="py-3 font-medium">Origen / destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {checks.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="py-3 pr-3 font-medium tabular-nums">
                    {c.number}
                  </td>
                  <td className="py-3 pr-3">{c.bank}</td>
                  <td className="py-3 pr-3 tabular-nums">
                    {formatMoney(c.amount, c.currency)}
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                    {c.dueDate
                      ? c.dueDate.toLocaleDateString("es-AR")
                      : "—"}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {c.drawerName ?? "—"}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${CHECK_STATUS_STYLE[c.status]}`}
                    >
                      {CHECK_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {c.receiptId && c.receiptNumber ? (
                      <Link
                        href={`/treasury/receipts/${c.receiptId}`}
                        className="text-accent hover:underline"
                      >
                        {c.receiptNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {c.paymentOrderId && c.paymentOrderNumber ? (
                      <>
                        {" → "}
                        <Link
                          href={`/treasury/payment-orders/${c.paymentOrderId}`}
                          className="text-accent hover:underline"
                        >
                          {c.paymentOrderNumber}
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
