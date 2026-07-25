import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "constructora_session";

export type LocalSessionPayload = {
  userId: string;
  organizationId: string;
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
    organizationId: payload.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function verifyLocalSession(
  token: string,
): Promise<LocalSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = payload.userId;
    const organizationId = payload.organizationId;
    if (typeof userId !== "string" || typeof organizationId !== "string") {
      return null;
    }
    return { userId, organizationId };
  } catch {
    return null;
  }
}
