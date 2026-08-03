"use client";

import { ArrowLeft } from "lucide-react";
import { APP_NAME } from "@/config/brand";

/**
 * Enlace nativo (no next/link) para Silk / Fire.
 * Barra en el flujo del documento (no fixed) para no tapar el contenido.
 */
export function TurneroBackToApp() {
  return (
    <div className="shrink-0 border-b border-neutral-800 bg-[#0a0a0a]">
      <a
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-neutral-400 transition hover:text-[#f97316] sm:px-6"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Volver a {APP_NAME}
      </a>
    </div>
  );
}