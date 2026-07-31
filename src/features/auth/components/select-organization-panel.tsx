"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOrganization,
  switchOrganization,
  type MyOrganization,
} from "@/features/auth/actions/organization-actions";
import { normalizeOrgSlug } from "@/features/auth/lib/org-slug";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type SelectOrganizationPanelProps = {
  organizations: MyOrganization[];
  requireChoice?: boolean;
};

export function SelectOrganizationPanel({
  organizations,
  requireChoice = false,
}: SelectOrganizationPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(organizations.length === 0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Error");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-lg space-y-6 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="text-center">
        <h1 className="font-display text-2xl tracking-tight">
          {requireChoice ? "Elegí una empresa" : "Empresas"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {requireChoice
            ? "Tu usuario pertenece a más de una empresa. Seleccioná con cuál trabajar."
            : "Cambiá de empresa o creá una nueva. Los datos de cada una están aislados."}
        </p>
      </div>

      {organizations.length > 0 && (
        <ul className="space-y-2">
          {organizations.map((org) => (
            <li key={org.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => switchOrganization(org.id))}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3 text-left transition-colors hover:border-accent/40 disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{org.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {org.slug} · {org.role}
                    {org.isActive ? " · activa" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-accent">
                  {org.isActive && !requireChoice ? "Entrar" : "Usar"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showCreate ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowCreate(true)}
          className="w-full rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-accent/40 hover:text-foreground"
        >
          + Crear empresa
        </button>
      ) : (
        <form
          className="space-y-3 rounded-md border border-border bg-background p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              createOrganization({
                name,
                slug: slug || undefined,
              }),
            );
          }}
        >
          <p className="text-sm font-medium">Nueva empresa</p>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Nombre</span>
            <input
              className={fieldClass}
              value={name}
              required
              minLength={2}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                if (!slugTouched) setSlug(normalizeOrgSlug(v));
              }}
              placeholder="Ej. Constructora Norte S.A."
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">
              Identificador (slug)
            </span>
            <input
              className={fieldClass}
              value={slug}
              required
              minLength={2}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(normalizeOrgSlug(e.target.value));
              }}
              placeholder="constructora-norte"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || name.trim().length < 2}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {pending ? "Creando…" : "Crear y entrar"}
            </button>
            {organizations.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setShowCreate(false);
                  setError(null);
                }}
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
