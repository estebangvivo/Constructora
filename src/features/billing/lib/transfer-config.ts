import {
  getTransferBankDetailsEffective,
  type TransferBankDetails,
} from "@/features/billing/lib/platform-billing-settings";

export type { TransferBankDetails };

/** Sync (env). Preferí getTransferBankDetailsEffective en server components. */
export function getTransferBankDetails(): TransferBankDetails {
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
      "Configurar BILLING_TRANSFER_ACCOUNT_USD",
    notes:
      process.env.BILLING_TRANSFER_NOTES?.trim() ||
      "Indicá en el concepto tu email de registro. La activación puede demorar hasta 1 día hábil.",
  };
}

export { getTransferBankDetailsEffective };

/** @deprecated Preferí isMercadoPagoConfigured async desde platform-billing-settings. */
export function isMercadoPagoConfiguredSync(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

export {
  isMercadoPagoConfigured,
  getMercadoPagoAccessToken,
} from "@/features/billing/lib/platform-billing-settings";
