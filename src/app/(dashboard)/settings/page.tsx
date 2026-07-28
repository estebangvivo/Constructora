import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOrganizationProfile } from "@/features/settings/queries/get-organization";
import {
  getLatestExchangeRate,
  listRecentExchangeRates,
} from "@/features/settings/queries/exchange-rates";
import { ensureTodayBnaRate } from "@/features/settings/lib/sync-bna-rate";
import { OrganizationSettingsForm } from "@/features/settings/components/organization-settings-form";
import { ExchangeRateForm } from "@/features/settings/components/exchange-rate-form";
import { BanksSettingsPanel } from "@/features/settings/components/banks-settings-panel";
import { listOrganizationUsers, listTurneroPuestosForUsers } from "@/features/auth/actions/user-actions";
import { UsersAdminPanel } from "@/features/auth/components/users-admin-panel";
import { hasModule } from "@/features/auth/lib/modules";
import { listBankAccounts } from "@/features/treasury/queries/bank-queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  if (
    !hasModule(session.allowedModules, "settings") &&
    !["ADMIN", "DIRECTOR"].includes(session.organizationRole)
  ) {
    redirect("/");
  }

  const organization = await getOrganizationProfile();
  if (!organization) redirect("/");

  try {
    await ensureTodayBnaRate(organization.id);
  } catch (error) {
    console.warn("ensureTodayBnaRate", error);
  }

  const canManageUsers =
    hasModule(session.allowedModules, "users") ||
    ["ADMIN", "DIRECTOR"].includes(session.organizationRole);

  const canManageBanks = ["ADMIN", "DIRECTOR"].includes(
    session.organizationRole,
  );

  const [latestUsdArs, recentRates, users, puestos, bankAccounts] =
    await Promise.all([
      getLatestExchangeRate("USD", "ARS"),
      listRecentExchangeRates(14),
      canManageUsers ? listOrganizationUsers() : Promise.resolve([]),
      canManageUsers ? listTurneroPuestosForUsers() : Promise.resolve([]),
      listBankAccounts(),
    ]);

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">Configuración</h1>
        <p className="mt-1 text-muted-foreground">
          Empresa, monedas, bancos, cotización y usuarios con permisos por
          módulo.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/settings/users" className="text-accent hover:underline">
            Ir a usuarios →
          </Link>
        </p>
      </div>
      <div className="space-y-10">
        <OrganizationSettingsForm organization={organization} />
        <BanksSettingsPanel
          accounts={bankAccounts}
          enabledCurrencies={organization.enabledCurrencies}
          canManage={canManageBanks}
        />
        <ExchangeRateForm
          enabledCurrencies={organization.enabledCurrencies}
          recentRates={recentRates}
          latestUsdArs={latestUsdArs}
        />
        {canManageUsers && (
          <UsersAdminPanel
            users={users}
            puestos={puestos}
            currentUserId={session.user.id}
            canAssignAdmin={session.organizationRole === "ADMIN"}
          />
        )}
      </div>
    </div>
  );
}
