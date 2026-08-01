import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Package } from "lucide-react";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import {
  listConsumptionsForDate,
  listInventoryByCategory,
} from "@/features/inventory/queries/list-inventory";
import { ConsumeInventoryForm } from "@/features/inventory/components/consume-inventory-form";
import { DateInput } from "@/components/ui/date-input";
import { formatQty } from "@/features/inventory/lib/labels";
import { formatDateAR, toDateInputValue } from "@/lib/format-date";
import { formatBudgetMoney } from "@/features/budget/lib/labels";

type PageProps = ProjectRouteParams & {
  searchParams: Promise<{ date?: string }>;
};

export default async function InventoryPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const sp = await searchParams;
  const project = await getProjectById(id);
  if (!project) notFound();

  const date = sp.date || toDateInputValue(new Date());
  const [groups, consumptions] = await Promise.all([
    listInventoryByCategory(id),
    listConsumptionsForDate(id, date),
  ]);

  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );
  const totalSkus = groups.reduce((a, g) => a + g.totalItems, 0);
  const lowStock = groups
    .flatMap((g) => g.items)
    .filter((i) => i.lowStock).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">Inventario</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock de la obra desde facturas de compra, ordenado por categoría.
            Consumí lo usado en el día.
          </p>
        </div>
        <Link
          href={`/projects/${id}/purchases`}
          className="text-sm text-accent hover:underline"
        >
          Ir a compras / facturas
        </Link>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Artículos</dt>
          <dd className="font-display text-xl">{totalSkus}</dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase text-muted-foreground">
            Categorías
          </dt>
          <dd className="font-display text-xl">{groups.length}</dd>
        </div>
        <div className="border-l-2 border-danger pl-3">
          <dt className="text-xs uppercase text-muted-foreground">
            Bajo mínimo
          </dt>
          <dd className="font-display text-xl">{lowStock}</dd>
        </div>
      </dl>

      {totalSkus === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 size-6 opacity-50" aria-hidden />
          Todavía no hay stock. Confirmá una{" "}
          <Link
            href={`/projects/${id}/purchases`}
            className="text-accent hover:underline"
          >
            factura de compra
          </Link>{" "}
          para ingresar artículos al inventario.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            {groups.map((group) => (
              <div key={group.category}>
                <h3 className="mb-2 font-medium">
                  {group.category}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({group.totalItems})
                  </span>
                </h3>
                <ul className="divide-y divide-border border-y border-border">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {item.name}
                          {item.lowStock && (
                            <span className="ml-2 rounded bg-danger/15 px-1.5 py-0.5 text-xs text-danger">
                              Bajo mínimo
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.location ? `${item.location} · ` : ""}
                          {item.unitCost != null
                            ? `Costo ${formatBudgetMoney(item.unitCost, project.currency ?? "ARS")}`
                            : "Sin costo"}
                        </p>
                      </div>
                      <p className="text-sm font-medium tabular-nums">
                        {formatQty(item.quantityOnHand)} {item.unit}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <div className="space-y-6">
            <ConsumeInventoryForm
              projectId={id}
              groups={groups}
              canManage={canManage}
            />

            <section className="space-y-3">
              <h3 className="font-medium">
                Consumos del {formatDateAR(date)}
              </h3>
              <form method="get" className="flex gap-2">
                <DateInput
                  name="date"
                  defaultValue={date}
                  className="w-full bg-surface"
                />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
                >
                  Ver
                </button>
              </form>
              {consumptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin consumos registrados en esta fecha.
                </p>
              ) : (
                <ul className="divide-y divide-border border-y border-border text-sm">
                  {consumptions.map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between gap-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{c.itemName}</p>
                        <p className="text-muted-foreground">
                          {c.itemCategory}
                          {c.notes ? ` · ${c.notes}` : ""}
                        </p>
                      </div>
                      <p className="tabular-nums text-danger">
                        −{formatQty(c.quantity)} {c.itemUnit}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
