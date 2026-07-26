import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients } from "@/features/clients/queries/list-clients";
import { CreateClientButton } from "@/features/clients/components/create-client-button";
import { mapClientBalances } from "@/features/treasury/queries/account-statements";
import { PartyDirectoryList } from "@/components/party-directory-list";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [clients, balances] = await Promise.all([
    listClients(),
    mapClientBalances(),
  ]);

  const items = clients.map((client) => {
    const ct = balances.get(client.id);
    return {
      id: client.id,
      name: client.name,
      taxId: client.taxId,
      email: client.email,
      phone: client.phone,
      contactName: client.contactName,
      isActive: client.isActive,
      projectCount: client.projectCount,
      balance: ct?.balance ?? 0,
      currency: ct?.currency ?? "ARS",
    };
  });

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Clientes</h1>
          <p className="mt-1 text-muted-foreground">
            Mandantes y contratantes que podés asignar a cada obra.
          </p>
        </div>
        <CreateClientButton />
      </div>

      <PartyDirectoryList
        kind="client"
        items={items}
        emptyMessage="Todavía no hay clientes. Creá el primero para vincularlo a una obra."
      />
    </div>
  );
}
