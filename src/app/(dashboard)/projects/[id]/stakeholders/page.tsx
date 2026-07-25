import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listActiveClients } from "@/features/clients/queries/list-clients";
import {
  listActiveSuppliers,
  listProjectSuppliers,
} from "@/features/suppliers/queries/list-suppliers";
import { ProjectStakeholdersForm } from "@/features/projects/components/project-stakeholders-form";
import type { ProjectRouteParams } from "@/types";
import { notFound } from "next/navigation";

export default async function ProjectStakeholdersPage({
  params,
}: ProjectRouteParams) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const [clients, availableSuppliers, linkedSuppliers] = await Promise.all([
    listActiveClients(),
    listActiveSuppliers(),
    listProjectSuppliers(id),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl tracking-tight">
          Cliente y proveedores
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Relacioná el mandante y los proveedores de esta obra.
        </p>
      </div>

      <ProjectStakeholdersForm
        projectId={id}
        currentClientId={project.clientId}
        clients={clients}
        linkedSuppliers={linkedSuppliers}
        availableSuppliers={availableSuppliers}
      />
    </div>
  );
}
