import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listSuppliers } from "@/features/suppliers/queries/list-suppliers";
import { CreateSupplierButton } from "@/features/suppliers/components/create-supplier-button";
import { mapSupplierBalances } from "@/features/treasury/queries/account-statements";
import { PartyDirectoryList } from "@/components/party-directory-list";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [suppliers, balances] = await Promise.all([
    listSuppliers(),
    mapSupplierBalances(),
  ]);

  const items = suppliers.map((supplier) => {
    const ct = balances.get(supplier.id);
    return {
      id: supplier.id,
      name: supplier.name,
      taxId: supplier.taxId,
      email: supplier.email,
      phone: supplier.phone,
      contactName: supplier.contactName,
      isActive: supplier.isActive,
      projectCount: supplier.projectCount,
      balance: ct?.balance ?? 0,
      currency: ct?.currency ?? "ARS",
    };
  });

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Proveedores</h1>
          <p className="mt-1 text-muted-foreground">
            Catálogo de proveedores para vincular a obras y compras.
          </p>
        </div>
        <CreateSupplierButton />
      </div>

      <PartyDirectoryList
        kind="supplier"
        items={items}
        emptyMessage="Todavía no hay proveedores. Creá el primero para asignarlo a una obra."
      />
    </div>
  );
}
