import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listClients } from "@/features/clients/queries/list-clients";
import { CreateClientButton } from "@/features/clients/components/create-client-button";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const clients = await listClients();

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

      {clients.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-surface/50 px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay clientes. Creá el primero para vincularlo a una obra.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-accent">
                  <Building2 className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">
                    {client.name}
                    {!client.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (inactivo)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[client.taxId, client.contactName, client.email, client.phone]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de contacto"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground sm:text-right">
                {client.projectCount} obra
                {client.projectCount === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
