import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrganizationSession } from "@/lib/auth";
import { getProjectById } from "@/features/projects/queries/get-projects";
import {
  getChangeOrderById,
  listBudgetItemsForChangeOrder,
} from "@/features/change-orders/queries/list-change-orders";
import { ChangeOrderForm } from "@/features/change-orders/components/change-order-form";

type Params = {
  params: Promise<{ id: string; coId: string }>;
};

export default async function EditChangeOrderPage({ params }: Params) {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const { id, coId } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  if (!["ADMIN", "DIRECTOR", "RESIDENT"].includes(session.organizationRole)) {
    redirect(`/projects/${id}/change-orders/${coId}`);
  }

  const co = await getChangeOrderById(coId);
  if (!co || co.projectId !== id) notFound();
  if (co.status !== "PENDING") {
    redirect(`/projects/${id}/change-orders/${coId}`);
  }

  const budgetItems = await listBudgetItemsForChangeOrder(id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}/change-orders/${coId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {co.number}
        </Link>
        <h2 className="mt-2 font-display text-xl tracking-tight">
          Editar {co.number}
        </h2>
      </div>
      <ChangeOrderForm
        projectId={id}
        currency={project.currency ?? "ARS"}
        budgetItems={budgetItems}
        mode="edit"
        changeOrderId={co.id}
        initial={{
          title: co.title,
          description: co.description ?? "",
          notes: co.notes ?? "",
          lines: co.items.map((i) => ({
            budgetItemId: i.budgetItemId,
            description: i.description,
            quantityDelta: i.quantityDelta,
            unitCostDelta: i.unitCostDelta,
            amountDelta: i.amountDelta,
          })),
        }}
      />
    </div>
  );
}
