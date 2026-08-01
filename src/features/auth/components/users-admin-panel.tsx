"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrganizationRole } from "@prisma/client";
import {
  createOrganizationUser,
  removeOrganizationUser,
  updateOrganizationUser,
  type TurneroPuestoOption,
  type ManageableOrganization,
} from "@/features/auth/actions/user-actions";
import {
  APP_MODULES,
  ROLE_DEFAULT_MODULES,
  type AppModuleKey,
} from "@/features/auth/lib/modules";
import {
  ETIQUETAS_CATEGORIA,
  type Categoria,
} from "@/features/turnero/lib/turnos";

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

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

const ROLE_OPTIONS: { value: OrganizationRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "DIRECTOR", label: "Dirección" },
  { value: "RESIDENT", label: "Residente" },
  { value: "PROVIDER", label: "Proveedor" },
  { value: "VIEWER", label: "Solo lectura" },
];

function etiquetaCategoria(categoria: string) {
  return ETIQUETAS_CATEGORIA[categoria as Categoria] ?? categoria;
}

type UsersAdminPanelProps = {
  users: UserRow[];
  puestos: TurneroPuestoOption[];
  organizations: ManageableOrganization[];
  currentOrganizationId: string;
  currentUserId: string;
  canAssignAdmin: boolean;
  /** En prueba gratis no se permiten altas. */
  trialBlocksNewUsers?: boolean;
};

export function UsersAdminPanel({
  users,
  puestos,
  organizations,
  currentOrganizationId,
  currentUserId,
  canAssignAdmin,
  trialBlocksNewUsers = false,
}: UsersAdminPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        window.alert(result.error ?? "Error");
        return;
      }
      setEditingId(null);
      setShowCreate(false);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Usuarios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Alta, baja, permisos, empresas y puesto de operador del turnero.
          </p>
        </div>
        <button
          type="button"
          disabled={trialBlocksNewUsers}
          title={
            trialBlocksNewUsers
              ? "Contratá un plan para dar de alta usuarios"
              : undefined
          }
          onClick={() => {
            if (trialBlocksNewUsers) return;
            setShowCreate((v) => !v);
            setEditingId(null);
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showCreate ? "Cerrar" : "Nuevo usuario"}
        </button>
      </div>

      {trialBlocksNewUsers && (
        <p
          role="status"
          className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-sm text-[#78350f]"
        >
          Estás en prueba gratis: no podés dar de alta usuarios.{" "}
          <Link
            href="/billing"
            className="font-medium underline underline-offset-2"
          >
            Ver planes
          </Link>
        </p>
      )}

      {showCreate && !trialBlocksNewUsers && (
        <UserForm
          mode="create"
          canAssignAdmin={canAssignAdmin}
          pending={pending}
          puestos={puestos}
          organizations={organizations}
          currentOrganizationId={currentOrganizationId}
          onCancel={() => setShowCreate(false)}
          onSubmit={(data) =>
            run(() =>
              createOrganizationUser({
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                password: data.password || undefined,
                role: data.role,
                allowedModules: data.allowedModules,
                turneroPuestoId: data.turneroPuestoId,
                organizationIds: data.organizationIds,
                organizationId: currentOrganizationId,
              }),
            )
          }
        />
      )}

      <ul className="divide-y divide-border border-y border-border">
        {users.map((u) => {
          const name =
            [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
          return (
            <li key={u.userId} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {name}{" "}
                    {!u.isActive && (
                      <span className="text-xs text-danger">(inactivo)</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {u.email} ·{" "}
                    {ROLE_OPTIONS.find((r) => r.value === u.role)?.label}
                    {!u.hasPassword ? " · sin contraseña local" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {u.allowedModules.length} módulos habilitados
                    {u.turneroPuestoNombre
                      ? ` · Turnero: ${u.turneroPuestoNombre}`
                      : " · Sin puesto de turnero"}
                  </p>
                  {u.organizations.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Empresas:{" "}
                      {u.organizations.map((o) => o.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setEditingId((id) =>
                        id === u.userId ? null : u.userId,
                      )
                    }
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
                  >
                    Editar
                  </button>
                  {u.userId !== currentUserId && canAssignAdmin && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `¿Quitar a ${name} de la organización?`,
                          )
                        ) {
                          return;
                        }
                        run(() =>
                          removeOrganizationUser(
                            u.userId,
                            currentOrganizationId,
                          ),
                        );
                      }}
                      className="rounded-md px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {editingId === u.userId && (
                <div className="mt-4">
                  <UserForm
                    mode="edit"
                    canAssignAdmin={canAssignAdmin}
                    pending={pending}
                    puestos={puestos}
                    organizations={organizations}
                    currentOrganizationId={currentOrganizationId}
                    initial={{
                      email: u.email,
                      firstName: u.firstName ?? "",
                      lastName: u.lastName ?? "",
                      phone: u.phone ?? "",
                      role: u.role,
                      isActive: u.isActive,
                      allowedModules: u.allowedModules as AppModuleKey[],
                      turneroPuestoId: u.turneroPuestoId,
                      organizationIds:
                        u.organizationIds.length > 0
                          ? u.organizationIds
                          : [currentOrganizationId],
                    }}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(data) =>
                      run(() =>
                        updateOrganizationUser({
                          userId: u.userId,
                          firstName: data.firstName,
                          lastName: data.lastName,
                          phone: data.phone,
                          role: data.role,
                          isActive: data.isActive ?? true,
                          allowedModules: data.allowedModules,
                          password: data.password || undefined,
                          turneroPuestoId: data.turneroPuestoId,
                          organizationIds: data.organizationIds,
                          organizationId: currentOrganizationId,
                        }),
                      )
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type FormData = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password?: string;
  role: OrganizationRole;
  isActive?: boolean;
  allowedModules: AppModuleKey[];
  turneroPuestoId: string | null;
  organizationIds: string[];
};

function UserForm({
  mode,
  canAssignAdmin,
  pending,
  puestos,
  organizations,
  currentOrganizationId,
  initial,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  canAssignAdmin: boolean;
  pending: boolean;
  puestos: TurneroPuestoOption[];
  organizations: ManageableOrganization[];
  currentOrganizationId: string;
  initial?: FormData;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
}) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<OrganizationRole>(
    initial?.role ?? "RESIDENT",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [modules, setModules] = useState<AppModuleKey[]>(
    initial?.allowedModules ?? [...ROLE_DEFAULT_MODULES.RESIDENT],
  );
  const [turneroPuestoId, setTurneroPuestoId] = useState(
    initial?.turneroPuestoId ?? "",
  );
  const [organizationIds, setOrganizationIds] = useState<string[]>(
    initial?.organizationIds?.length
      ? initial.organizationIds
      : [currentOrganizationId],
  );

  const globalMods = useMemo(
    () => APP_MODULES.filter((m) => m.group === "global"),
    [],
  );
  const obraMods = useMemo(
    () => APP_MODULES.filter((m) => m.group === "obra"),
    [],
  );

  function onRoleChange(next: OrganizationRole) {
    setRole(next);
    setModules([...ROLE_DEFAULT_MODULES[next]]);
  }

  function toggleModule(key: AppModuleKey) {
    if (role === "ADMIN") return;
    setModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function toggleOrganization(orgId: string) {
    setOrganizationIds((prev) => {
      if (prev.includes(orgId)) {
        if (orgId === currentOrganizationId) return prev;
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== orgId);
      }
      return [...prev, orgId];
    });
  }

  return (
    <form
      className="space-y-4 rounded-md border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          email,
          firstName,
          lastName,
          phone,
          password: password || undefined,
          role,
          isActive,
          allowedModules:
            role === "ADMIN" ? [...ROLE_DEFAULT_MODULES.ADMIN] : modules,
          turneroPuestoId: turneroPuestoId || null,
          organizationIds,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {mode === "create" && (
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nombre</span>
          <input
            className={fieldClass}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Apellido</span>
          <input
            className={fieldClass}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Teléfono</span>
          <input
            className={fieldClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Rol</span>
          <select
            className={fieldClass}
            value={role}
            onChange={(e) => onRoleChange(e.target.value as OrganizationRole)}
          >
            {ROLE_OPTIONS.filter(
              (r) => r.value !== "ADMIN" || canAssignAdmin,
            ).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        {organizations.length > 0 && (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">
              Empresas a las que puede acceder
            </legend>
            <div className="space-y-1.5 rounded-md border border-border bg-background p-3">
              {organizations.map((org) => {
                const checked = organizationIds.includes(org.id);
                const lockedCurrent =
                  org.id === currentOrganizationId && checked;
                return (
                  <label
                    key={org.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={lockedCurrent}
                      onChange={() => toggleOrganization(org.id)}
                    />
                    <span>
                      {org.name}
                      {org.id === currentOrganizationId ? " (actual)" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Solo aparecen empresas donde sos Admin o Dirección. La empresa
              actual queda marcada.
            </p>
          </fieldset>
        )}

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">
            Puesto de operador (turnero)
          </span>
          <select
            className={fieldClass}
            value={turneroPuestoId}
            onChange={(e) => setTurneroPuestoId(e.target.value)}
          >
            <option value="">Sin puesto asignado</option>
            {puestos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {etiquetaCategoria(p.categoria)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            Aplica a la empresa actual. Si está asignado, el panel de operador
            puede preseleccionarlo.
          </span>
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">
            Contraseña
            {mode === "edit"
              ? " (opcional)"
              : " (obligatoria si el email es nuevo)"}
          </span>
          <input
            type="password"
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={password ? 8 : undefined}
            placeholder={
              mode === "edit"
                ? "Dejar vacío para no cambiar"
                : "Si el email ya existe en otra empresa, se invita sin cambiar su clave"
            }
          />
          {password ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              Mín. 8 caracteres, mayúscula, número y carácter especial.
            </span>
          ) : null}
        </label>
        {mode === "edit" && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Usuario activo
          </label>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          Módulos permitidos
          {role === "ADMIN" ? " (Admin tiene todos)" : ""}
        </p>
        <ModuleChecks
          title="Empresa"
          items={globalMods}
          selected={modules}
          disabled={role === "ADMIN" || pending}
          onToggle={toggleModule}
        />
        <ModuleChecks
          title="Por obra"
          items={obraMods}
          selected={modules}
          disabled={role === "ADMIN" || pending}
          onToggle={toggleModule}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ModuleChecks({
  title,
  items,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  items: { key: AppModuleKey; label: string }[];
  selected: AppModuleKey[];
  disabled: boolean;
  onToggle: (key: AppModuleKey) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex items-center gap-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.key) || disabled}
              disabled={disabled}
              onChange={() => onToggle(item.key)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}
