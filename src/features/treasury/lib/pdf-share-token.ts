import { SignJWT, jwtVerify } from "jose";

export type PdfSharePayload = {
  kind: "receipt" | "payment-order";
  id: string;
  organizationId: string;
};

function secretKey() {
  const raw =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "dev-only-pdf-share-secret";
  return new TextEncoder().encode(raw);
}

export async function signPdfShareToken(
  payload: PdfSharePayload,
): Promise<string> {
  return new SignJWT({
    kind: payload.kind,
    id: payload.id,
    organizationId: payload.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secretKey());
}

export async function verifyPdfShareToken(
  token: string,
): Promise<PdfSharePayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const kind = payload.kind;
    const id = payload.id;
    const organizationId = payload.organizationId;
    if (
      (kind !== "receipt" && kind !== "payment-order") ||
      typeof id !== "string" ||
      typeof organizationId !== "string"
    ) {
      return null;
    }
    return { kind, id, organizationId };
  } catch {
    return null;
  }
}
