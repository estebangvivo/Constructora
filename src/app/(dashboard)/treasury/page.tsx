import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, FileInput, FileOutput, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  listPaymentOrders,
  listReceipts,
} from "@/features/treasury/queries/list-treasury";
import {
  formatMoney,
  TREASURY_STATUS_LABEL,
  TREASURY_STATUS_STYLE,
} from "@/features/treasury/lib/labels";
import {
  formatMoneyByCurrency,
  sumByCurrency,
} from "@/config/currencies";
import type { TreasuryDocStatus } from "@prisma/client";
import { getCashOverview } from "@/features/treasury/queries/cash-queries";
import { formatCashMoney } from "@/features/treasury/lib/cash-labels";

export const dynamic = "force-dynamic";

function isActive(status: TreasuryDocStatus) {
  return status !== "CANCELLED";
}

export default async function TreasuryPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [receipts, orders, cash] = await Promise.all([
    listReceipts(),
    listPaymentOrders(),
    getCashOverview("ARS"),
  ]);

  const incomeTotal = sumByCurrency(
    receipts
      .filter((r) => isActive(r.status))
      .map((r) => ({ currency: r.currency, amount: r.totalAmount })),
  );
  const expenseTotal = sumByCurrency(
    orders
      .filter((r) => isActive(r.status))
      .map((r) => ({ currency: r.currency, amount: r.totalAmount })),
  );
  const incomePosted = sumByCurrency(
    receipts
      .filter((r) => r.status === "POSTED")
      .map((r) => ({ currency: r.currency, amount: r.totalAmount })),
  );
  const expensePosted = sumByCurrency(
    orders
      .filter((r) => r.status === "POSTED")
      .map((r) => ({ currency: r.currency, amount: r.totalAmount })),
  );

  const pendingReceipts = receipts.filter(
    (r) => r.status === "DRAFT" || r.status === "ISSUED",
  ).length;
  const pendingOrders = orders.filter(
    (r) => r.status === "DRAFT" || r.status === "ISSUED",
  ).length;

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">Tesorería</h1>
        <p className="mt-1 text-muted-foreground">
          Recibos y órdenes de pago en ARS / USD (u otras monedas habilitadas).
        </p>
      </div>

      <dl className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="border-l-2 border-success pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Ingresos
          </dt>
          <dd className="mt-1 font-display text-xl">
            {formatMoneyByCurrency(incomeTotal)}
          </dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            Imputados: {formatMoneyByCurrency(incomePosted)}
          </dd>
        </div>
        <div className="border-l-2 border-danger pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Egresos
          </dt>
          <dd className="mt-1 font-display text-xl">
            {formatMoneyByCurrency(expenseTotal)}
          </dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            Imputados: {formatMoneyByCurrency(expensePosted)}
          </dd>
        </div>
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Multimoneda
          </dt>
          <dd className="mt-1 text-sm text-muted-foreground">
            Los totales se muestran por moneda (no se mezclan ARS con USD).
          </dd>
        </div>
      </dl>

      {(pendingReceipts > 0 || pendingOrders > 0) && (
        <p className="mb-6 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-foreground">
          Hay documentos pendientes de imputar
          {pendingReceipts > 0
            ? ` (${pendingReceipts} recibo${pendingReceipts === 1 ? "" : "s"})`
            : ""}
          {pendingOrders > 0
            ? `${pendingReceipts > 0 ? " y" : ""} (${pendingOrders} orden${pendingOrders === 1 ? "" : "es"} de pago)`
            : ""}
          . Abrí el detalle y usá{" "}
          <span className="font-medium">Imputar a presupuesto</span>.
        </p>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/treasury/cash"
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 hover:border-accent/40 sm:col-span-1"
        >
          <span className="flex size-10 items-center justify-center rounded-md bg-background text-accent">
            <Wallet className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-medium">Caja</span>
            <span className="text-sm text-muted-foreground">
              Diaria{" "}
              {formatCashMoney(cash.daily.balance, cash.daily.currency)}
              {" · "}
              Tesorería{" "}
              {formatCashMoney(cash.treasury.balance, cash.treasury.currency)}
            </span>
          </span>
        </Link>
        <Link
          href="/treasury/receipts/new"
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 hover:border-accent/40"
        >
          <span className="flex size-10 items-center justify-center rounded-md bg-background text-success">
            <FileInput className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-medium">Nuevo recibo</span>
            <span className="text-sm text-muted-foreground">
              Cobros en ARS o USD
            </span>
          </span>
        </Link>
        <Link
          href="/treasury/payment-orders/new"
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 hover:border-accent/40"
        >
          <span className="flex size-10 items-center justify-center rounded-md bg-background text-danger">
            <FileOutput className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-medium">Nueva orden de pago</span>
            <span className="text-sm text-muted-foreground">
              Pagos en ARS o USD
            </span>
          </span>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-tight">Recibos</h2>
            <Link
              href="/treasury/receipts"
              className="text-sm text-accent hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <DocList
            items={receipts.slice(0, 5)}
            href={(id) => `/treasury/receipts/${id}`}
            empty="Sin recibos aún."
          />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-tight">
              Órdenes de pago
            </h2>
            <Link
              href="/treasury/payment-orders"
              className="text-sm text-accent hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <DocList
            items={orders.slice(0, 5)}
            href={(id) => `/treasury/payment-orders/${id}`}
            empty="Sin órdenes de pago aún."
          />
        </section>
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Banknote className="size-3.5" aria-hidden />
        Configurá el tipo de cambio USD/ARS en Configuración si necesitás
        equivalencias.
      </p>
    </div>
  );
}

function DocList({
  items,
  href,
  empty,
}: {
  items: Awaited<ReturnType<typeof listReceipts>>;
  href: (id: string) => string;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => {
        const needsPost =
          item.status === "DRAFT" || item.status === "ISSUED";
        return (
          <li key={item.id}>
            <Link
              href={href(item.id)}
              className="flex flex-col gap-1 py-3 hover:bg-surface/60 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {item.number}{" "}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${TREASURY_STATUS_STYLE[item.status]}`}
                  >
                    {TREASURY_STATUS_LABEL[item.status]}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.partyName}
                  {item.concept ? ` · ${item.concept}` : ""}
                  {needsPost ? " · Pendiente de imputar" : ""}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums">
                {formatMoney(item.totalAmount, item.currency)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
