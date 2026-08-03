"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";

type CertificationPrintToolbarProps = {
  backHref: string;
  pdfUrl: string;
  filename: string;
  autoPrint?: boolean;
};

export function CertificationPrintToolbar({
  backHref,
  pdfUrl,
  filename,
  autoPrint = false,
}: CertificationPrintToolbarProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  async function downloadPdf() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(pdfUrl, { credentials: "same-origin" });
      if (!res.ok) throw new Error("No se pudo generar el PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al descargar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 border-b border-[#d6d3d1] bg-[#f3f1ec]/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#d6d3d1] bg-white px-3 py-2 text-sm text-[#1c1917] hover:bg-[#fafaf9]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#d6d3d1] bg-white px-3 py-2 text-sm hover:bg-[#fafaf9] disabled:opacity-60"
        >
          <Printer className="size-4" aria-hidden />
          Imprimir
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void downloadPdf()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1c1917] px-3 py-2 text-sm font-medium text-white hover:bg-[#292524] disabled:opacity-60"
        >
          <Download className="size-4" aria-hidden />
          Descargar PDF
        </button>
      </div>
      {error ? (
        <p className="mx-auto max-w-3xl px-4 pb-3 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
