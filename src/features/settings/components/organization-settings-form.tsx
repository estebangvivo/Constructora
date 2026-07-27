"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { updateOrganizationProfile } from "@/features/settings/actions/update-organization";
import type { OrganizationProfile } from "@/features/settings/queries/get-organization";
import { formatCuitInput } from "@/lib/arca/tax-id";
import {
  COLOR_PALETTES,
  applyThemeToDocument,
  DEFAULT_THEME_ID,
} from "@/config/themes";
import { APP_CURRENCIES } from "@/config/currencies";
import { cn } from "@/lib/utils";

type OrganizationSettingsFormProps = {
  organization: OrganizationProfile;
};

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-accent placeholder:text-muted-foreground focus:ring-2";

export function OrganizationSettingsForm({
  organization,
}: OrganizationSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [clearLogo, setClearLogo] = useState(false);
  const [preview, setPreview] = useState<string | null>(() =>
    organization.logoUrl?.startsWith("data:") ||
    (organization.logoUrl?.startsWith("/uploads/") &&
      process.env.NODE_ENV !== "production")
      ? organization.logoUrl
      : organization.logoUrl?.startsWith("http")
        ? organization.logoUrl
        : null,
  );
  const [taxId, setTaxId] = useState(() =>
    formatCuitInput(organization.taxId ?? ""),
  );
  const [themeId, setThemeId] = useState(
    organization.themeId || DEFAULT_THEME_ID,
  );
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(
    organization.enabledCurrencies?.length
      ? organization.enabledCurrencies
      : ["ARS", "USD"],
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const formData = new FormData(e.currentTarget);
    formData.set("taxId", taxId);
    formData.set("themeId", themeId);
    if (clearLogo) formData.set("clearLogo", "1");

    startTransition(async () => {
      const result = await updateOrganizationProfile(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setClearLogo(false);
      applyThemeToDocument(themeId);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg tracking-tight">Identidad</h2>
          <p className="text-sm text-muted-foreground">
            Datos legales y de marca de la constructora.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Nombre comercial
            </span>
            <input
              name="name"
              required
              defaultValue={organization.name}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Razón social
            </span>
            <input
              name="legalName"
              defaultValue={organization.legalName ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">CUIT</span>
            <input
              name="taxId"
              value={taxId}
              onChange={(e) => setTaxId(formatCuitInput(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="30-71234567-8"
              maxLength={13}
              className={cn(
                fieldClass,
                "max-w-[14rem] font-mono text-sm tracking-wide tabular-nums",
              )}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Formato XX-XXXXXXXX-X
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">País</span>
            <input
              name="country"
              defaultValue={organization.country ?? "AR"}
              className={cn(fieldClass, "max-w-[8rem] uppercase")}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Moneda principal (reporte)
            </span>
            <select
              name="currency"
              defaultValue={organization.currency || "ARS"}
              className={cn(fieldClass, "max-w-xs")}
            >
              {APP_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">
              Recomendadas: ARS o USD. El sistema es multimoneda.
            </span>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm text-muted-foreground">
              Monedas habilitadas
            </legend>
            <input
              type="hidden"
              name="enabledCurrencies"
              value={enabledCurrencies.join(",")}
            />
            <div className="flex flex-wrap gap-3">
              {APP_CURRENCIES.map((c) => {
                const checked = enabledCurrencies.includes(c.code);
                return (
                  <label
                    key={c.code}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={c.code === "ARS" || c.code === "USD"}
                      onChange={(e) => {
                        setEnabledCurrencies((prev) => {
                          if (e.target.checked) {
                            return [...new Set([...prev, c.code])];
                          }
                          return prev.filter((code) => code !== c.code);
                        });
                      }}
                    />
                    <span>
                      {c.code}
                      {c.primary ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (habitual)
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              ARS y USD quedan siempre disponibles. Podés habilitar otras si las
              necesitás.
            </p>
          </fieldset>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Aviso de cheques por vencer (días)
            </span>
            <input
              name="checkDueAlertDays"
              type="number"
              min={0}
              max={365}
              step={1}
              required
              defaultValue={organization.checkDueAlertDays ?? 7}
              className={cn(fieldClass, "max-w-[8rem]")}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Se muestra un aviso en toda la app cuando un cheque en cartera
              vence dentro de esta cantidad de días (0 = solo vencidos).
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Logo</p>
          <div className="flex flex-wrap items-center gap-4">
            {preview && !clearLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={`Logo ${organization.name}`}
                className="size-20 rounded-md border border-border bg-surface object-contain p-1"
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                Sin logo
              </div>
            )}
            <div className="space-y-2">
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setClearLogo(false);
                  setPreview(URL.createObjectURL(file));
                }}
                className="block w-full max-w-xs text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm"
              />
              {organization.logoUrl && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={clearLogo}
                    onChange={(e) => {
                      setClearLogo(e.target.checked);
                      if (e.target.checked) setPreview(null);
                      else setPreview(organization.logoUrl);
                    }}
                  />
                  Quitar logo actual
                </label>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg tracking-tight">
            Paleta de colores
          </h2>
          <p className="text-sm text-muted-foreground">
            Elegí una propuesta para personalizar la interfaz. Se aplica al
            guardar.
          </p>
        </div>
        <input type="hidden" name="themeId" value={themeId} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_PALETTES.map((palette) => {
            const selected = themeId === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => {
                  setThemeId(palette.id);
                  applyThemeToDocument(palette.id);
                }}
                className={cn(
                  "relative rounded-md border px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-accent bg-surface-elevated ring-2 ring-accent/40"
                    : "border-border bg-surface hover:border-accent/40",
                )}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-3" aria-hidden />
                  </span>
                )}
                <span className="mb-2 flex gap-1.5" aria-hidden>
                  {palette.swatches.map((color) => (
                    <span
                      key={color}
                      className="size-6 rounded-sm border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                <span className="block text-sm font-medium">{palette.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {palette.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg tracking-tight">Contacto</h2>
          <p className="text-sm text-muted-foreground">
            Dirección, teléfono y correo institucional.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Dirección</span>
            <input
              name="address"
              defaultValue={organization.address ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Ciudad</span>
            <input
              name="city"
              defaultValue={organization.city ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Provincia</span>
            <input
              name="province"
              defaultValue={organization.province ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Código postal
            </span>
            <input
              name="postalCode"
              defaultValue={organization.postalCode ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Teléfono</span>
            <input
              name="phone"
              defaultValue={organization.phone ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Email</span>
            <input
              type="email"
              name="email"
              defaultValue={organization.email ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">WhatsApp</span>
            <input
              name="whatsapp"
              defaultValue={organization.whatsapp ?? ""}
              placeholder="+54 9 11 ..."
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Sitio web</span>
            <input
              name="website"
              defaultValue={organization.website ?? ""}
              placeholder="https://"
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg tracking-tight">
            Redes sociales
          </h2>
          <p className="text-sm text-muted-foreground">
            URLs completas de cada perfil.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Facebook</span>
            <input
              name="facebookUrl"
              defaultValue={organization.facebookUrl ?? ""}
              placeholder="https://facebook.com/..."
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Instagram</span>
            <input
              name="instagramUrl"
              defaultValue={organization.instagramUrl ?? ""}
              placeholder="https://instagram.com/..."
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">LinkedIn</span>
            <input
              name="linkedinUrl"
              defaultValue={organization.linkedinUrl ?? ""}
              placeholder="https://linkedin.com/company/..."
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">X (Twitter)</span>
            <input
              name="xUrl"
              defaultValue={organization.xUrl ?? ""}
              placeholder="https://x.com/..."
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-success" role="status">
          Datos guardados correctamente.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
