import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  listAdminOrganizationProfiles,
  listAdminOrganizationsOverview,
} from "@/features/auth/actions/admin-panel-actions";
import {
  listManageableOrganizationsForUsers,
  listOrganizationUsers,
  listTurneroPuestosForUsers,
} from "@/features/auth/actions/user-actions";
import { listPendingBillingPayments } from "@/features/billing/actions/admin-billing-actions";
import { getAdminMercadoPagoConfig } from "@/features/billing/actions/admin-mercadopago-actions";
import { listAllFeatureRequestsForAdmin } from "@/features/feature-requests/actions/feature-request-actions";
import { AdminPanel } from "@/features/auth/components/admin-panel";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{ org?: string; tab?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const superadmin = isPlatformSuperadmin(session);
  if (!superadmin && !session.organizationId) {
    redirect("/onboarding/planes");
  }
  if (!superadmin && session.organizationRole !== "ADMIN") {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const organizations = await listManageableOrganizationsForUsers();

  const requestedOrgId = params.org?.trim() || "";
  const targetOrganizationId =
    (requestedOrgId &&
      organizations.some((o) => o.id === requestedOrgId) &&
      requestedOrgId) ||
    session.organizationId ||
    organizations[0]?.id ||
    "";

  const targetOrgName =
    organizations.find((o) => o.id === targetOrganizationId)?.name ?? null;

  const [
    overview,
    orgProfiles,
    users,
    puestos,
    currentOrg,
    pendingPayments,
    mercadoPagoConfig,
    featureRequests,
  ] = await Promise.all([
    listAdminOrganizationsOverview(),
    listAdminOrganizationProfiles(),
    targetOrganizationId
      ? listOrganizationUsers(targetOrganizationId)
      : Promise.resolve([]),
    targetOrganizationId
      ? listTurneroPuestosForUsers(targetOrganizationId)
      : Promise.resolve([]),
    session.organizationId
      ? prisma.organization.findUnique({
          where: { id: session.organizationId },
          select: { name: true, billingStatus: true },
        })
      : Promise.resolve(null),
    listPendingBillingPayments(),
    superadmin ? getAdminMercadoPagoConfig() : Promise.resolve(null),
    superadmin ? listAllFeatureRequestsForAdmin() : Promise.resolve([]),
  ]);

  const initialTab =
    params.tab === "users" ||
    params.tab === "companies" ||
    params.tab === "connected" ||
    params.tab === "payments" ||
    params.tab === "mercadopago" ||
    params.tab === "requests"
      ? params.tab
      : undefined;

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">Administración</h1>
        <p className="mt-1 text-muted-foreground">
          {superadmin
            ? `Superadmin (${session.user.email}): elegí la empresa en Alta y permisos o Empresas para gestionar usuarios y perfiles sin cambiar de sesión.`
            : "Usuarios por empresa, presencia en línea, alta de cuentas, configuración y revisión de pagos SaaS."}
        </p>
      </div>
      <AdminPanel
        overview={overview}
        orgProfiles={orgProfiles}
        users={users}
        puestos={puestos}
        organizations={organizations}
        currentOrganizationId={targetOrganizationId}
        currentOrganizationName={
          targetOrgName ??
          currentOrg?.name ??
          (superadmin ? "Sin empresa" : "Empresa actual")
        }
        currentUserId={session.user.id}
        pendingPayments={pendingPayments}
        canReviewPayments={
          superadmin || currentOrg?.billingStatus === "EXEMPT"
        }
        isPlatformSuperadmin={superadmin}
        mercadoPagoConfig={mercadoPagoConfig}
        featureRequests={featureRequests}
        initialTab={initialTab}
      />
    </div>
  );
}
