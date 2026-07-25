import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export type TreasuryProjectOption = {
  id: string;
  code: string;
  name: string;
  clientId: string | null;
  supplierIds: string[];
};

/** Obras con vínculos a cliente y proveedores (para filtrar en tesorería). */
export async function listProjectsForTreasury(): Promise<
  TreasuryProjectOption[]
> {
  const session = await requireSession();

  const projects = await prisma.project.findMany({
    where: {
      organizationId: session.organizationId,
      deletedAt: null,
      status: { in: ["DRAFT", "ACTIVE", "ON_HOLD"] },
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      clientId: true,
      projectSuppliers: { select: { supplierId: true } },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    clientId: p.clientId,
    supplierIds: p.projectSuppliers.map((s) => s.supplierId),
  }));
}
