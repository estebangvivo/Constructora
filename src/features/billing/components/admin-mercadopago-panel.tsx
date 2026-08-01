"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Copy, Check } from "lucide-react";
import {
  saveAdminMercadoPagoConfig,
} from "@/features/billing/actions/admin-mercadopago-actions";
import type { MercadoPagoConfigPublic } from "@/features/billing/lib/platform-billing-settings";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type AdminMercadoPagoPanelProps = {
  config: MercadoPagoConfigPublic;
};

export function AdminMercadoPagoPanel({ config }: AdminMercadoPagoPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [copied, setCopied] = useState(false);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    startTransition(async () => {
      const result = await saveAdminMercadoPagoConfig({
        accessToken: accessToken || undefined,
        publicKey: publicKey || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAccessToken("");
      setPublicKey("");
      setOk(true);
      router.refresh();
    });
  }

  function onClear() {
    if (!window.confirm("¿Quitar el Access Token guardado en la base?")) return;
    setError(null);
    setOk(false);
    startTransition(async () => {
      const result = await saveAdminMercadoPagoConfig({ clearToken: true });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(config.webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar la URL.");
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="font-display text-xl tracking-tight inline-flex items-center gap-2">
          <CreditCard className="size-5" aria-hidden />
          Mercado Pago
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Access Token de tu aplicación en{" "}
          <a
            href="https://www.mercadopago.com.ar/developers/panel/app"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-2"
          >
            Developers → Tus integraciones
          </a>
          . Con esto entran los pagos de planes SaaS.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-surface/40 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Estado:</span>{" "}
          {config.configured ? (
            <span className="font-medium text-emerald-700">Configurado</span>
          ) : (
            <span className="font-medium text-amber-800">Sin configurar</span>
          )}
          {config.fromEnv ? " (desde variable de entorno)" : null}
        </p>
        {config.tokenHint && (
          <p>
            <span className="text-muted-foreground">Token:</span>{" "}
            <code className="text-xs">{config.tokenHint}</code>
          </p>
        )}
        <div className="pt-1">
          <p className="mb-1 text-muted-foreground">
            URL de notificaciones (webhook) — pegala en el panel de MP:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="block max-w-full truncate rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              {config.webhookUrl}
            </code>
            <button
              type="button"
              onClick={copyWebhook}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-surface"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-4 rounded-lg border border-border p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Access Token</span>
          <input
            type="password"
            autoComplete="off"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className={fieldClass}
            placeholder={
              config.configured
                ? "Dejá vacío para mantener el actual"
                : "APP_USR-… o TEST-…"
            }
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Public Key <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <input
            type="text"
            autoComplete="off"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            className={fieldClass}
            placeholder={
              config.publicKeyHint
                ? "Dejá vacío para mantener la actual"
                : "APP_USR-… (pública)"
            }
          />
        </label>

        {error && (
          <p className="rounded-md border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {ok && (
          <p className="rounded-md border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Guardado.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending || (!accessToken.trim() && !publicKey.trim())}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          {config.configured && !config.fromEnv && (
            <button
              type="button"
              disabled={pending}
              onClick={onClear}
              className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
            >
              Quitar token de la base
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
