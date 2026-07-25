import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export type SupplierListItem = {
  id: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  isActive: boolean;
  projectCount: number;
};

export async function listSuppliers(): Promise<SupplierListItem[]> {
  const session = await requireSession();

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { projects: true } },
    },
  });

  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    taxId: s.taxId,
    email: s.email,
    phone: s.phone,
    contactName: s.contactName,
    isActive: s.isActive,
    projectCount: s._count.projects,
  }));
}

export async function listActiveSuppliers() {
  const session = await requireSession();

  return prisma.supplier.findMany({
    where: {
      organizationId: session.organizationId,
      isActive: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      taxId: true,
    },
  });
}

export type ProjectSupplierItem = {
  id: string;
  supplierId: string;
  name: string;
  taxId: string | null;
  roleNotes: string | null;
  isPrimary: boolean;
};

export async function listProjectSuppliers(
  projectId: string,
): Promise<ProjectSupplierItem[]> {
  const session = await requireSession();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!project) return [];

  const links = await prisma.projectSupplier.findMany({
    where: { projectId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: {
      supplier: {
        select: { id: true, name: true, taxId: true },
      },
    },
  });

  return links.map((link) => ({
    id: link.id,
    supplierId: link.supplier.id,
    name: link.supplier.name,
    taxId: link.supplier.taxId,
    roleNotes: link.roleNotes,
    isPrimary: link.isPrimary,
  }));
}
