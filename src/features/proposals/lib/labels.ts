import type { ProposalStatus } from "@prisma/client";
import { normalizeCurrency } from "@/config/currencies";

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  REJECTED: "Rechazado",
  CONVERTED: "Convertido en obra",
};

export const PROPOSAL_STATUS_STYLE: Record<ProposalStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-accent/15 text-accent",
  REJECTED: "bg-danger/15 text-danger",
  CONVERTED: "bg-success/15 text-success",
};

export function formatProposalMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(value);
}
