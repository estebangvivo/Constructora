import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "default";

export type MercadoPagoConfigPublic = {
  configured: boolean;
  /** true si el token viene de env (no editable desde UI sin sobrescribir en DB). */
  fromEnv: boolean;
  tokenHint: string | null;
  publicKeyHint: string | null;
  webhookUrl: string;
};

function maskSecret(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.length <= 8) return "••••••••";
  return `${"•".repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function readDbSettings() {
  try {
    return await prisma.platformBillingSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
  } catch (error) {
    console.warn("platformBillingSettings read", error);
    return null;
  }
}

/** Access token: DB (admin) tiene prioridad sobre env. */
export async function getMercadoPagoAccessToken(): Promise<string | null> {
  const row = await readDbSettings();
  const fromDb = row?.mpAccessToken?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  return fromEnv || null;
}

export async function isMercadoPagoConfigured(): Promise<boolean> {
  return Boolean(await getMercadoPagoAccessToken());
}

export async function getMercadoPagoConfigPublic(): Promise<MercadoPagoConfigPublic> {
  const row = await readDbSettings();
  const dbToken = row?.mpAccessToken?.trim() || null;
  const envToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || null;
  const token = dbToken || envToken;
  return {
    configured: Boolean(token),
    fromEnv: Boolean(!dbToken && envToken),
    tokenHint: maskSecret(token),
    publicKeyHint: maskSecret(row?.mpPublicKey),
    webhookUrl: `${appBaseUrl()}/api/billing/mercadopago/webhook`,
  };
}

export async function upsertMercadoPagoSettings(input: {
  accessToken?: string | null;
  publicKey?: string | null;
  clearToken?: boolean;
  clearPublicKey?: boolean;
  updatedByUserId?: string | null;
}): Promise<void> {
  const current = await readDbSettings();

  let mpAccessToken = current?.mpAccessToken ?? null;
  if (input.clearToken) {
    mpAccessToken = null;
  } else if (input.accessToken != null && input.accessToken.trim()) {
    mpAccessToken = input.accessToken.trim();
  }

  let mpPublicKey = current?.mpPublicKey ?? null;
  if (input.clearPublicKey) {
    mpPublicKey = null;
  } else if (input.publicKey != null && input.publicKey.trim()) {
    mpPublicKey = input.publicKey.trim();
  }

  await prisma.platformBillingSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      mpAccessToken,
      mpPublicKey,
      updatedByUserId: input.updatedByUserId ?? null,
    },
    update: {
      mpAccessToken,
      mpPublicKey,
      updatedByUserId: input.updatedByUserId ?? null,
    },
  });
}
