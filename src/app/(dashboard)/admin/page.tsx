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

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.organizationId) redirect("/onboarding/planes");

  const superadmin = isPlatformSuperadmin(session);
  if (!superadmin && session.organizationRole !== "ADMIN") {
    redirect("/");
  }

  const [
    overview,
    orgProfiles,
    users,
    puestos,
    organizations,
    currentOrg,
    pendingPayments,
    mercadoPagoConfig,
    featureRequests,
  ] = await Promise.all([
    listAdminOrganizationsOverview(),
    listAdminOrganizationProfiles(),
    listOrganizationUsers(),
    listTurneroPuestosForUsers(),
    listManageableOrganizationsForUsers(),
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true, billingStatus: true },
    }),
    listPendingBillingPayments(),
    superadmin ? getAdminMercadoPagoConfig() : Promise.resolve(null),
    superadmin ? listAllFeatureRequestsForAdmin() : Promise.resolve([]),
  ]);

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">Administración</h1>
        <p className="mt-1 text-muted-foreground">
          {superadmin
            ? `Superadmin (${session.user.email}): todas las empresas de la plataforma, sin importar la empresa activa.`
            : "Usuarios por empresa, presencia en línea, alta de cuentas, configuración y revisión de pagos SaaS."}
        </p>
      </div>
      <AdminPanel
        overview={overview}
        orgProfiles={orgProfiles}
        users={users}
        puestos={puestos}
        organizations={organizations}
        currentOrganizationId={session.organizationId}
        currentOrganizationName={currentOrg?.name ?? "Empresa actual"}
        currentUserId={session.user.id}
        pendingPayments={pendingPayments}
        canReviewPayments={
          superadmin || currentOrg?.billingStatus === "EXEMPT"
        }
        isPlatformSuperadmin={superadmin}
        mercadoPagoConfig={mercadoPagoConfig}
        featureRequests={featureRequests}
      />
    </div>
  );
}
