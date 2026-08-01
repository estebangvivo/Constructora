import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "constructora_session";

export type LocalSessionPayload = {
  userId: string;
  /** null = usuario sin empresa (onboarding / pago). */
  organizationId: string | null;
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
    return {
      userId,
      organizationId: organizationId.length > 0 ? organizationId : null,
    };
  } catch {
    return null;
  }
}
