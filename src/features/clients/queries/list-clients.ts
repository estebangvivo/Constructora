import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export type ClientListItem = {
  id: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  isActive: boolean;
  projectCount: number;
};

export async function listClients(): Promise<ClientListItem[]> {
  const session = await requireSession();

  const clients = await prisma.client.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { projects: true } },
    },
  });

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    taxId: c.taxId,
    email: c.email,
    phone: c.phone,
    contactName: c.contactName,
    isActive: c.isActive,
    projectCount: c._count.projects,
  }));
}

export async function listActiveClients() {
  const session = await requireSession();

  return prisma.client.findMany({
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
