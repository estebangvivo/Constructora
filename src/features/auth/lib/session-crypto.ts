import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "constructora_session";

export type LocalSessionPayload = {
  userId: string;
  /** null = usuario sin empresa (onboarding / pago). */
  organizationId: string | null;
  /**
   * Versión de sesión del usuario.
   * Al loguearse desde otro dispositivo se incrementa y este JWT queda inválido
   * (excepto superadmins de plataforma).
   */
  sessionVersion: number;
};

function secretKey() {
  const raw =
    process.env.AUTH_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    "constructora-dev-secret-change-me";
  return new TextEncoder().encode(raw);
}

export async function signLocalSession(
  payload: LocalSessionPayload,
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    organizationId: payload.organizationId ?? "",
    sv: payload.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function verifyLocalSession(
  token: string,
): Promise<LocalSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = payload.userId;
    const organizationId = payload.organizationId;
    if (typeof userId !== "string") return null;
    if (typeof organizationId !== "string") return null;
    const sv = payload.sv;
    const sessionVersion =
      typeof sv === "number" && Number.isFinite(sv) ? Math.trunc(sv) : 0;
    return {
      userId,
      organizationId: organizationId.length > 0 ? organizationId : null,
      sessionVersion,
    };
  } catch {
    return null;
  }
}
