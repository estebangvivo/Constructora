import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { ProposalStatus } from "@prisma/client";

export type ProposalListItem = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  currency: string;
  status: ProposalStatus;
  clientName: string | null;
  totalCost: number;
  itemCount: number;
  createdAt: Date;
  convertedProjectId: string | null;
};

export async function listProposals(): Promise<ProposalListItem[]> {
  const session = await requireSession();

  const rows = await prisma.proposal.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      client: { select: { name: true } },
      items: { select: { totalCost: true } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    city: p.city,
    currency: p.currency,
    status: p.status,
    clientName: p.client?.name ?? null,
    totalCost: p.items.reduce((s, i) => s + Number(i.totalCost), 0),
    itemCount: p.items.length,
    createdAt: p.createdAt,
    convertedProjectId: p.convertedProjectId,
  }));
}

export type ProposalDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  currency: string;
  status: ProposalStatus;
  notes: string | null;
  clientId: string | null;
  clientName: string | null;
  convertedProjectId: string | null;
  convertedProjectCode: string | null;
  items: {
    id: string;
    code: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    currency: string;
  }[];
};

export async function getProposal(
  proposalId: string,
): Promise<ProposalDetail | null> {
  const session = await requireSession();

  const p = await prisma.proposal.findFirst({
    where: { id: proposalId, organizationId: session.organizationId },
    include: {
      client: { select: { id: true, name: true } },
      convertedProject: { select: { id: true, code: true } },
      items: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }] },
    },
  });

  if (!p) return null;

  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    address: p.address,
    city: p.city,
    currency: p.currency,
    status: p.status,
    notes: p.notes,
    clientId: p.clientId,
    clientName: p.client?.name ?? null,
    convertedProjectId: p.convertedProjectId,
    convertedProjectCode: p.convertedProject?.code ?? null,
    items: p.items.map((i) => ({
      id: i.id,
      code: i.code,
      description: i.description,
      quantity: Number(i.quantity),
      unit: i.unit,
      unitCost: Number(i.unitCost),
      totalCost: Number(i.totalCost),
      currency: i.currency,
    })),
  };
}
