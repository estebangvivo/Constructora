"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationRole } from "@prisma/client";
import {
  Circle,
  Building2,
  Users,
  Settings2,
  Banknote,
  CreditCard,
  Lightbulb,
} from "lucide-react";
import type {
  AdminOrganizationOverview,
} from "@/features/auth/actions/admin-panel-actions";
import type { ManageableOrganization } from "@/features/auth/actions/user-actions";
import type { TurneroPuestoOption } from "@/features/auth/actions/user-actions";
import { UsersAdminPanel } from "@/features/auth/components/users-admin-panel";
import { OrganizationSettingsForm } from "@/features/settings/components/organization-settings-form";
import type { OrganizationProfile } from "@/features/settings/queries/get-organization";
import { createOrganization } from "@/features/auth/actions/organization-actions";
import { normalizeOrgSlug } from "@/features/auth/lib/org-slug";
import { AdminBillingPaymentsPanel } from "@/features/billing/components/admin-billing-payments-panel";
import { AdminMercadoPagoPanel } from "@/features/billing/components/admin-mercadopago-panel";
import type { MercadoPagoConfigPublic } from "@/features/billing/lib/platform-billing-settings";
import {
  AdminSuperadminOrgsPanel,
  OrgBillingBadge,
} from "@/features/auth/components/admin-superadmin-orgs-panel";
import { AdminFeatureRequestsPanel } from "@/features/feature-requests/components/admin-feature-requests-panel";
import type { FeatureRequestListItem } from "@/features/feature-requests/components/feature-request-list";
import { cn } from "@/lib/utils";

type UserRow = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  hasPassword: boolean;
  role: OrganizationRole;
  allowedModules: string[];
  turneroPuestoId: string | null;
  turneroPuestoNombre: string | null;
  organizationIds: string[];
  organizations: { id: string; name: string }[];
};

type TabId =
  | "connected"
  | "users"
  | "companies"
  | "payments"
  | "mercadopago"
  | "requests";

const ROLE_LABEL: Record<OrganizationRole, string> = {
  ADMIN: "Admin",
  DIRECTOR: "Dirección",
  RESIDENT: "Residente",
  PROVIDER: "Proveedor",
  VIEWER: "Solo lectura",
};

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

function formatLastSeen(iso: string | null, isOnline: boolean) {
  if (isOnline) return "En línea";
  if (!iso) return "Sin actividad";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} d`;
}

type AdminPanelProps = {
  overview: AdminOrganizationOverview[];
  orgProfiles: OrganizationProfile[];
  users: UserRow[];
  puestos: TurneroPuestoOption[];
  organizations: ManageableOrganization[];
  currentOrganizationId: string;
  currentOrganizationName: string;
  currentUserId: string;
  pendingPayments: React.ComponentProps<
    typeof AdminBillingPaymentsPanel
  >["payments"];
  canReviewPayments: boolean;
  isPlatformSuperadmin?: boolean;
  mercadoPagoConfig?: MercadoPagoConfigPublic | null;
  featureRequests?: Array<
    FeatureRequestListItem & {
      organizationName: string;
      createdByName: string;
      createdByEmail: string;
    }
  >;
};

export function AdminPanel({
  overview,
  orgProfiles,
  users,
  puestos,
  organizations,
  currentOrganizationId,
  currentOrganizationName,
  currentUserId,
  pendingPayments,
  canReviewPayments,
  isPlatformSuperadmin = false,
  mercadoPagoConfig = null,
  featureRequests = [],
}: AdminPanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("connected");
  const [selectedOrgId, setSelectedOrgId] = useState(
    () => orgProfiles[0]?.id ?? currentOrganizationId,
  );
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [pending, startTransition] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");

  const selectedProfile = useMemo(
    () => orgProfiles.find((o) => o.id === selectedOrgId) ?? orgProfiles[0],
    [orgProfiles, selectedOrgId],
  );

  const totalOnline = overview.reduce((s, o) => s + o.onlineCount, 0);
  const totalMembers = overview.reduce((s, o) => s + o.memberCount, 0);

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: "connected", label: "Usuarios por empresa", icon: Circle },
    { id: "users", label: "Alta y permisos", icon: Users },
    { id: "companies", label: "Empresas", icon: Building2 },
    ...(canReviewPayments
      ? [{ id: "payments" as const, label: "Pagos", icon: Banknote }]
      : []),
    ...(isPlatformSuperadmin
      ? [
          {
            id: "requests" as const,
            label: "Mejoras",
            icon: Lightbulb,
          },
          {
            id: "mercadopago" as const,
            label: "Mercado Pago",
            icon: CreditCard,
          },
        ]
      : []),
  ];

  function submitCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    startTransition(async () => {
      const result = await createOrganization({
        name: createName,
        slug: createSlug || undefined,
        switchTo: false,
      });
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      setShowCreateOrg(false);
      setCreateName("");
      setCreateSlug("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "connected" && (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{overview.length}</span>{" "}
              empresas
              {isPlatformSuperadmin ? " (plataforma)" : ""}
            </p>
            <p>
              <span className="font-medium text-foreground">{totalMembers}</span>{" "}
              usuarios
            </p>
            <p className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-foreground">{totalOnline}</span>{" "}
              en línea ahora
            </p>
          </div>

          {isPlatformSuperadmin ? (
            <AdminSuperadminOrgsPanel overview={overview} />
          ) : overview.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No administrás ninguna empresa todavía.
            </p>
          ) : (
            overview.map((org) => (
              <div
                key={org.id}
                className="overflow-hidden rounded-lg border border-border"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface/50 px-4 py-3">
                  <div>
                    <h2 className="font-display text-lg tracking-tight">
                      {org.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">{org.slug}</p>
                    <OrgBillingBadge
                      billingStatus={org.billingStatus}
                      billingPlan={org.billingPlan}
                      paidUntil={org.paidUntil}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {org.onlineCount}/{org.memberCount} en línea
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Usuario</th>
                        <th className="px-4 py-2 font-medium">Rol</th>
                        <th className="px-4 py-2 font-medium">Estado</th>
                        <th className="px-4 py-2 font-medium">Presencia</th>
                        <th className="px-4 py-2 font-medium">Módulos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {org.members.map((m) => {
                        const name =
                          [m.firstName, m.lastName].filter(Boolean).join(" ") ||
                          m.email;
                        return (
                          <tr key={m.membershipId}>
                            <td className="px-4 py-3">
                              <p className="font-medium">{name}</p>
                              <p className="text-xs text-muted-foreground">
                                {m.email}
                              </p>
                            </td>
                            <td className="px-4 py-3">{ROLE_LABEL[m.role]}</td>
                            <td className="px-4 py-3">
                              {m.isActive ? (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Activo
                                </span>
                              ) : (
                                <span className="text-danger">Inactivo</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    m.isOnline && m.isActive
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground/40",
                                  )}
                                />
                                {formatLastSeen(
                                  m.lastSeenAt,
                                  m.isOnline && m.isActive,
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {m.allowedModules.length}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === "users" && (
        <section className="space-y-4">
          <p className="rounded-md border border-border bg-surface/40 px-3 py-2 text-sm text-muted-foreground">
            Alta y edición de usuarios de la empresa activa:{" "}
            <span className="font-medium text-foreground">
              {currentOrganizationName}
            </span>
            . Para trabajar sobre otra, cambiá de empresa y volvé a este panel.
          </p>
          <UsersAdminPanel
            users={users}
            puestos={puestos}
            organizations={organizations}
            currentOrganizationId={currentOrganizationId}
            currentUserId={currentUserId}
            canAssignAdmin
          />
        </section>
      )}

      {tab === "companies" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl tracking-tight">Empresas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Creá empresas nuevas o editá el perfil de las que administrás.
                {isPlatformSuperadmin
                  ? " Como superadmin también ves empresas de prueba y clientes SaaS."
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateOrg((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
            >
              <Settings2 className="size-4" />
              {showCreateOrg ? "Cerrar" : "Nueva empresa"}
            </button>
          </div>

          {showCreateOrg && (
            <form
              onSubmit={submitCreateOrg}
              className="max-w-lg space-y-3 rounded-lg border border-border p-4"
            >
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Nombre comercial
                </span>
                <input
                  required
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value);
                    if (!createSlug) {
                      /* slug se deriva al guardar si vacío */
                    }
                  }}
                  className={fieldClass}
                  placeholder="Mi Constructora"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Identificador (slug)
                </span>
                <input
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  className={fieldClass}
                  placeholder={
                    createName
                      ? normalizeOrgSlug(createName)
                      : "mi-constructora"
                  }
                />
              </label>
              {createError && (
                <p className="text-sm text-danger">{createError}</p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
              >
                {pending ? "Creando…" : "Crear empresa"}
              </button>
            </form>
          )}

          {orgProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay empresas para configurar.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {orgProfiles.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => setSelectedOrgId(org.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm",
                      selectedOrgId === org.id
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-surface",
                    )}
                  >
                    {org.name}
                    {isPlatformSuperadmin ? (
                      <span className="ml-1 text-xs opacity-70">
                        ({org.slug})
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {selectedProfile && (
                <OrganizationSettingsForm
                  key={selectedProfile.id}
                  organization={selectedProfile}
                  targetOrganizationId={selectedProfile.id}
                />
              )}
            </>
          )}
        </section>
      )}

      {tab === "payments" && canReviewPayments && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl tracking-tight">
              Pagos por transferencia
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Aprobá comprobantes para activar o renovar empresas.
            </p>
          </div>
          <AdminBillingPaymentsPanel payments={pendingPayments} />
        </section>
      )}

      {tab === "requests" && isPlatformSuperadmin && (
        <section>
          <AdminFeatureRequestsPanel requests={featureRequests} />
        </section>
      )}

      {tab === "mercadopago" && isPlatformSuperadmin && mercadoPagoConfig && (
        <section>
          <AdminMercadoPagoPanel config={mercadoPagoConfig} />
        </section>
      )}
    </div>
  );
}
