"use client";

import Link from "next/link";
import { Printer } from "lucide-react";

type ShareTreasuryDocButtonProps = {
  printHref: string;
  /** @deprecated ya no se usa: el PDF se comparte desde la vista de impresión */
  pdfUrl?: string;
  doc?: unknown;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
};

/**
 * Entra a la vista de reporte en pantalla, donde está el botón de WhatsApp.
 */
export function ShareTreasuryDocButton({ printHref }: ShareTreasuryDocButtonProps) {
  return (
    <Link
      href={printHref}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
    >
      <Printer className="size-4" aria-hidden />
      Ver reporte
    </Link>
  );
}
