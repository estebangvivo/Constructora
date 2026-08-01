import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProjectRouteParams } from "@/types";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { listBudgetItemsForChangeOrder } from "@/features/change-orders/queries/list-change-orders";
import { ChangeOrderForm } from "@/features/change-orders/components/change-order-form";

export default async function NewChangeOrderPage({
  params,
}: ProjectRouteParams) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  if (!["ADMIN", "DIRECTOR", "RESIDENT"].includes(session.organizationRole)) {
    redirect(`/projects/${id}/change-orders`);
  }

  const budgetItems = await listBudgetItemsForChangeOrder(id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}/change-orders`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Órdenes de cambio
        </Link>
        <h2 className="mt-2 font-display text-xl tracking-tight">
          Nueva orden de cambio
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Definí el impacto por partida. Quedará pendiente hasta aprobación de
          dirección.
        </p>
      </div>
      <ChangeOrderForm
        projectId={id}
        currency={project.currency ?? "ARS"}
        budgetItems={budgetItems}
      />
    </div>
  );
}
