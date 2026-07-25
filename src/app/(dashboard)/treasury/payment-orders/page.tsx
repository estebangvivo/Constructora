import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listPaymentOrders } from "@/features/treasury/queries/list-treasury";
import {
  formatMoney,
  TREASURY_STATUS_LABEL,
  TREASURY_STATUS_STYLE,
} from "@/features/treasury/lib/labels";

export const dynamic = "force-dynamic";

export default async function PaymentOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const orders = await listPaymentOrders();

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/treasury" className="hover:text-foreground">
              Tesorería
            </Link>
          </p>
          <h1 className="font-display text-3xl tracking-tight">
            Órdenes de pago
          </h1>
        </div>
        <Link
          href="/treasury/payment-orders/new"
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
        >
          <Plus className="size-4" aria-hidden />
          Nueva orden
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay órdenes de pago.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {orders.map((item) => (
            <li key={item.id}>
              <Link
                href={`/treasury/payment-orders/${item.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {item.number}{" "}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs ${TREASURY_STATUS_STYLE[item.status]}`}
                    >
                      {TREASURY_STATUS_LABEL[item.status]}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.partyName}
                    {item.projectLabels.length
                      ? ` · ${item.projectLabels.join(", ")}`
                      : ""}
                  </p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatMoney(item.totalAmount, item.currency)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
