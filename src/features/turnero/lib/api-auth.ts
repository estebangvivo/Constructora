import {
  getOrganizationSession,
  type OrganizationSession,
} from "@/lib/auth";

/**
 * Devuelve la sesión activa (con organizationId) o null si no hay usuario
 * autenticado. Las rutas de /api/turnero deben usar SIEMPRE este helper
 * para filtrar por organización y nunca exponer datos de otro tenant.
 */
export async function requireTurneroOrg(): Promise<OrganizationSession | null> {
  return getOrganizationSession();
}
