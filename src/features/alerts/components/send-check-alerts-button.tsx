"use client";

import { useState, useTransition } from "react";
import { sendCheckDueAlertsNow } from "@/features/alerts/actions/alert-actions";

/** Botón para disparar alerta de cheques por email/WhatsApp. */
export function SendCheckAlertsButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await sendCheckDueAlertsNow(true);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      if (res.skipped) {
        setMsg(res.reason ?? "No se envió.");
        return;
      }
      const channels = [
        res.email ? "email" : null,
        res.whatsapp ? "WhatsApp" : null,
        res.notifiedUsers > 0 ? `aviso in-app (${res.notifiedUsers})` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setMsg(channels ? `Enviado: ${channels}` : "Sin canales configurados.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar alerta email/WhatsApp"}
      </button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
