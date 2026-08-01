import { prisma } from "@/lib/prisma";

export type TransferBankDetails = {
  accountName: string;
  taxId: string;
  bankNameArs: string;
  cbuArs: string;
  aliasArs: string;
  bankNameUsd: string;
  accountUsd: string;
  notes: string;
};

const SETTINGS_ID = "default";
const DEFAULT_MP_SURCHARGE_PERCENT = 4;

type SettingsRow = {
  mpAccessToken: string | null;
  mpPublicKey: string | null;
  mpSurchargePercent: unknown;
  transferAccountName: string | null;
  transferTaxId: string | null;
  transferBankNameArs: string | null;
  transferCbuArs: string | null;
  transferAliasArs: string | null;
  transferBankNameUsd: string | null;
  transferAccountUsd: string | null;
  transferNotes: string | null;
};

export type MercadoPagoConfigPublic = {
  configured: boolean;
  /** true si el token viene de env (no editable desde UI sin sobrescribir en DB). */
  fromEnv: boolean;
  tokenHint: string | null;
  publicKeyHint: string | null;
  webhookUrl: string;
  /** Recargo % aplicado solo a Mercado Pago. */
  surchargePercent: number;
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

function envTransferDefaults(): TransferBankDetails {
  return {
    accountName:
      process.env.BILLING_TRANSFER_ACCOUNT_NAME?.trim() || "Buñas S.A.S.",
    taxId: process.env.BILLING_TRANSFER_TAX_ID?.trim() || "30-00000000-0",
    bankNameArs:
      process.env.BILLING_TRANSFER_BANK_ARS?.trim() || "Banco Galicia",
    cbuArs:
      process.env.BILLING_TRANSFER_CBU_ARS?.trim() || "0070000000000000000000",
    aliasArs: process.env.BILLING_TRANSFER_ALIAS_ARS?.trim() || "BUNAS.PAGOS",
    bankNameUsd:
      process.env.BILLING_TRANSFER_BANK_USD?.trim() || "Cuenta USD",
    accountUsd:
      process.env.BILLING_TRANSFER_ACCOUNT_USD?.trim() ||
      "Configurar cuenta USD",
    notes:
      process.env.BILLING_TRANSFER_NOTES?.trim() ||
      "Indicá en el concepto tu email de registro. La activación puede demorar hasta 1 día hábil.",
  };
}

function parseSurcharge(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MP_SURCHARGE_PERCENT;
  return Math.min(100, Math.round(n * 100) / 100);
}

/**
 * Lectura vía SQL: el cliente Prisma local a veces no regenera (DLL bloqueado)
 * y no conoce aún mpSurchargePercent / transfer*.
 */
async function readDbSettings(): Promise<SettingsRow | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<SettingsRow[]>(
      `SELECT
        "mpAccessToken",
        "mpPublicKey",
        "mpSurchargePercent",
        "transferAccountName",
        "transferTaxId",
        "transferBankNameArs",
        "transferCbuArs",
        "transferAliasArs",
        "transferBankNameUsd",
        "transferAccountUsd",
        "transferNotes"
      FROM "platform_billing_settings"
      WHERE id = $1
      LIMIT 1`,
      SETTINGS_ID,
    );
    return rows[0] ?? null;
  } catch (error) {
    console.warn("platformBillingSettings read", error);
    return null;
  }
}

async function ensureSettingsRow(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "platform_billing_settings" (id, "updatedAt")
     VALUES ($1, NOW())
     ON CONFLICT (id) DO NOTHING`,
    SETTINGS_ID,
  );
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

export async function getMpSurchargePercent(): Promise<number> {
  const row = await readDbSettings();
  if (!row || row.mpSurchargePercent == null) {
    return DEFAULT_MP_SURCHARGE_PERCENT;
  }
  return parseSurcharge(row.mpSurchargePercent);
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
    surchargePercent: parseSurcharge(row?.mpSurchargePercent),
  };
}

/** Datos bancarios: DB (admin) pisa env. */
export async function getTransferBankDetailsEffective(): Promise<TransferBankDetails> {
  const env = envTransferDefaults();
  const row = await readDbSettings();
  if (!row) return env;
  return {
    accountName: row.transferAccountName?.trim() || env.accountName,
    taxId: row.transferTaxId?.trim() || env.taxId,
    bankNameArs: row.transferBankNameArs?.trim() || env.bankNameArs,
    cbuArs: row.transferCbuArs?.trim() || env.cbuArs,
    aliasArs: row.transferAliasArs?.trim() || env.aliasArs,
    bankNameUsd: row.transferBankNameUsd?.trim() || env.bankNameUsd,
    accountUsd: row.transferAccountUsd?.trim() || env.accountUsd,
    notes: row.transferNotes?.trim() || env.notes,
  };
}

export async function upsertMercadoPagoSettings(input: {
  accessToken?: string | null;
  publicKey?: string | null;
  clearToken?: boolean;
  clearPublicKey?: boolean;
  surchargePercent?: number | null;
  updatedByUserId?: string | null;
}): Promise<void> {
  const current = await readDbSettings();
  await ensureSettingsRow();

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

  const mpSurchargePercent =
    input.surchargePercent != null
      ? parseSurcharge(input.surchargePercent)
      : parseSurcharge(current?.mpSurchargePercent);

  await prisma.$executeRawUnsafe(
    `UPDATE "platform_billing_settings"
     SET
       "mpAccessToken" = $1,
       "mpPublicKey" = $2,
       "mpSurchargePercent" = $3,
       "updatedByUserId" = $4,
       "updatedAt" = NOW()
     WHERE id = $5`,
    mpAccessToken,
    mpPublicKey,
    mpSurchargePercent,
    input.updatedByUserId ?? null,
    SETTINGS_ID,
  );
}

export async function upsertTransferBankSettings(input: {
  details: TransferBankDetails;
  updatedByUserId?: string | null;
}): Promise<void> {
  const d = input.details;
  await ensureSettingsRow();

  await prisma.$executeRawUnsafe(
    `UPDATE "platform_billing_settings"
     SET
       "transferAccountName" = $1,
       "transferTaxId" = $2,
       "transferBankNameArs" = $3,
       "transferCbuArs" = $4,
       "transferAliasArs" = $5,
       "transferBankNameUsd" = $6,
       "transferAccountUsd" = $7,
       "transferNotes" = $8,
       "updatedByUserId" = $9,
       "updatedAt" = NOW()
     WHERE id = $10`,
    d.accountName.trim() || null,
    d.taxId.trim() || null,
    d.bankNameArs.trim() || null,
    d.cbuArs.trim() || null,
    d.aliasArs.trim() || null,
    d.bankNameUsd.trim() || null,
    d.accountUsd.trim() || null,
    d.notes.trim() || null,
    input.updatedByUserId ?? null,
    SETTINGS_ID,
  );
}
