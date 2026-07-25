"use server";

import { listBudgetItemsForProject } from "@/features/treasury/queries/list-treasury";

export async function getBudgetItemsAction(projectId: string) {
  if (!projectId) return [];
  return listBudgetItemsForProject(projectId);
}
