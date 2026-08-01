"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationRole } from "@prisma/client";
import {
  updateOrganizationBillingBySuperadmin,
  type AdminOrganizationOverview,
} from "@/features/auth/actions/admin-panel-actions";
import {
  BILLING_PLANS,
  normalizeBillingPlanId,
} from "@/features/billing/lib/plans";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<OrganizationRole, string> = {
  ADMIN: "Admin",
  DIRECTOR: "Dirección",
  RESIDENT: "Residente",
  PROVIDER: "Proveedor",
  VIEWER: "Solo lectura",
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activa" },
  { value: "PAST_DUE", label: "Vencida" },
  { value: "PENDING_PAYMENT", label: "Pago pendiente" },
  { value: "EXEMPT", label: "Exenta (sin cobro)" },
] as const;

const PLAN_OPTIONS = [
  { value: "NONE", label: "Sin plan" },
  ...Object.values(BILLING_PLANS).map((p) => ({
    value: p.id,
    label: p.label,
  })),
];

const fieldClass =
  "rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-accent focus:ring-2";

function planLabel(plan: string | null): string {
  const id = normalizeBillingPlanId(plan);
  if (!id) return plan ?? "—";
  return BILLING_PLANS[id].label;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type AdminSuperadminOrgsPanelProps = {
  overview: AdminOrganizationOverview[];
};

export function AdminSuperadminOrgsPanel({
  overview,
}: AdminSuperadminOrgsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("ACTIVE");
  const [plan, setPlan] = useState("NONE");
  const [paidUntil, setPaidUntil] = useState("");

  function startEdit(org: AdminOrganizationOverview) {
    setEditingId(org.id);
    setError(null);
    setStatus(org.billingStatus);
    setPlan(org.billingPlan ?? "NONE");
    setPaidUntil(toDateInputValue(org.paidUntil));
  }

  function save(organizationId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationBillingBySuperadmin({
        organizationId,
        billingStatus: status,
        billingPlan: plan === "NONE" ? null : plan,
        paidUntil: paidUntil || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  if (overview.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay empresas registradas.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Vista de plataforma: todas las empresas, usuarios y plan. Podés cambiar
        estado, plan y vigencia.
      </p>
      {error && (
        <p className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {overview.map((org) => {
        const editing = editingId === org.id;
        return (
          <div
            key={org.id}
            className="overflow-hidden rounded-lg border border-border"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface/50 px-4 py-3">
              <div>
                <h2 className="font-display text-lg tracking-tight">
                  {org.name}
                </h2>
                <p className="text-xs text-muted-foreground">{org.slug}</p>
                {!editing && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Plan:</span>{" "}
                    {planLabel(org.billingPlan)}
                    {" · "}
                    <span className="text-muted-foreground">Estado:</span>{" "}
                    {org.billingStatus}
                    {" · "}
                    <span className="text-muted-foreground">Hasta:</span>{" "}
                    {org.paidUntil
                      ? new Date(org.paidUntil).toLocaleDateString("es-AR")
                      : "—"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {org.onlineCount}/{org.memberCount} en línea
                </p>
                {!editing ? (
                  <button
                    type="button"
                    onClick={() => startEdit(org)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
                  >
                    Editar plan
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => save(org.id)}
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
                    >
                      {pending ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            {editing && (
              <div className="flex flex-wrap gap-3 border-b border-border bg-surface/30 px-4 py-3">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Estado</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={fieldClass}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Plan</span>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className={fieldClass}
                  >
                    {PLAN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Vigente hasta
                  </span>
                  <input
                    type="date"
                    value={paidUntil}
                    onChange={(e) => setPaidUntil(e.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Usuario</th>
                    <th className="px-4 py-2 font-medium">Rol</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
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
                            <span className="text-emerald-700">Activo</span>
                          ) : (
                            <span className="text-danger">Inactivo</span>
                          )}
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
        );
      })}
    </div>
  );
}

/** Badge compacto de plan para la vista normal de admin. */
export function OrgBillingBadge({
  billingStatus,
  billingPlan,
  paidUntil,
}: {
  billingStatus: string;
  billingPlan: string | null;
  paidUntil: string | null;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground")}>
      {planLabel(billingPlan)} · {billingStatus}
      {paidUntil
        ? ` · hasta ${new Date(paidUntil).toLocaleDateString("es-AR")}`
        : ""}
    </p>
  );
}
