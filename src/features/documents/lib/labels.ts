import type { DocumentType } from "@prisma/client";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  PLAN: "Plano",
  SPEC: "Especificación",
  CONTRACT: "Contrato",
  REPORT: "Informe",
  PHOTO: "Foto",
  OTHER: "Otro",
};

export const DOCUMENT_TYPE_STYLE: Record<DocumentType, string> = {
  PLAN: "bg-accent/15 text-accent",
  SPEC: "bg-muted text-muted-foreground",
  CONTRACT: "bg-success/15 text-success",
  REPORT: "bg-accent/10 text-foreground",
  PHOTO: "bg-muted text-muted-foreground",
  OTHER: "bg-muted text-muted-foreground",
};

export const DOCUMENT_TYPES = Object.keys(
  DOCUMENT_TYPE_LABEL,
) as DocumentType[];

/** Sugerencias de carpeta lógica (category libre). */
export const DOCUMENT_CATEGORY_SUGGESTIONS = [
  "Arquitectura",
  "Estructural",
  "MEP",
  "Legal",
  "Contratos",
  "Seguridad e higiene",
  "Calidad",
  "Cómputos",
  "Actas",
  "Fotos de avance",
] as const;
