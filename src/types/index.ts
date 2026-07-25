/**
 * Roles RBAC alineados con OrganizationRole del schema Prisma.
 * Definidos localmente para no depender de `@prisma/client` en la capa UI.
 */
export type AppRole =
  | "ADMIN"
  | "DIRECTOR"
  | "RESIDENT"
  | "PROVIDER"
  | "VIEWER";

export type IdParam = { id: string };

export type ProjectRouteParams = {
  params: Promise<{ id: string }>;
};
