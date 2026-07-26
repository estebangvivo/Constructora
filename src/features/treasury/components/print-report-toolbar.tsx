"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, Printer, Share2 } from "lucide-react";
import {
  buildMailtoShareUrl,
  buildWhatsAppShareUrl,
} from "@/features/treasury/lib/share-message";

type PrintReportToolbarProps = {
  backHref: string;
  backLabel: string;
  pdfUrl: string;
  filename: string;
  shareTitle: string;
  /** Texto corto para WhatsApp / mail si no hay share nativo. */
  shareText?: string;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
};

async function fetchPdfFile(pdfUrl: string, filename: string): Promise<File> {
  const res = await fetch(pdfUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error("No se pudo generar el PDF.");
  const blob = await res.blob();
  return new File([blob], filename, { type: "application/pdf" });
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function supportsFileShare(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  try {
    if (typeof navigator.canShare === "function") {
      return navigator.canShare({ files: [file] });
    }
  } catch {
    return false;
  }
  // Sin canShare: asumimos que share existe (probar al click)
  return true;
}

export function PrintReportToolbar({
  backHref,
  backLabel,
  pdfUrl,
  filename,
  shareTitle,
  shareText = "",
  defaultPhone,
  defaultEmail,
}: PrintReportToolbarProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    fileRef.current = null;
    void (async () => {
      try {
        const file = await fetchPdfFile(pdfUrl, filename);
        if (cancelled) return;
        fileRef.current = file;
        setReady(true);
      } catch {
        if (!cancelled) {
          setError("No se pudo preparar el PDF para compartir.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, filename]);

  async function ensureFile(): Promise<File> {
    if (fileRef.current) return fileRef.current;
    const file = await fetchPdfFile(pdfUrl, filename);
    fileRef.current = file;
    setReady(true);
    return file;
  }

  async function onShareClick() {
    setError(null);
    setPending(true);
    try {
      const file = await ensureFile();

      // Importante: share en el mismo gesto del usuario (PDF ya precargado)
      if (supportsFileShare(file)) {
        try {
          await navigator.share({ files: [file], title: shareTitle });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          // Sigue al fallback
        }
      }

      // PC / navegador sin share de archivos: elegir canal
      setFallbackOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo compartir.");
    } finally {
      setPending(false);
    }
  }

  function openWhatsAppFallback() {
    const file = fileRef.current;
    if (file) triggerDownload(file);
    const text =
      shareText.trim() ||
      `${shareTitle}\n\nAdjuntá el PDF ${filename} con el clip.`;
    window.open(
      buildWhatsAppShareUrl(
        phone,
        `${text}\n\n(Adjuntá el archivo ${filename} con el clip)`,
      ),
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openMailFallback() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Indicá un correo válido.");
      return;
    }
    const file = fileRef.current;
    if (file) triggerDownload(file);
    window.location.href = buildMailtoShareUrl(
      trimmed,
      shareTitle,
      `${shareText || shareTitle}\n\nAdjuntá el archivo descargado: ${filename}`,
    );
  }

  return (
    <>
      <div className="print:hidden sticky top-0 z-20 border-b border-border bg-surface-elevated/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {backLabel}
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
            >
              <Printer className="size-4" aria-hidden />
              Imprimir
            </button>
            <button
              type="button"
              disabled={pending || !ready}
              onClick={() => void onShareClick()}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
            >
              <Share2 className="size-4" aria-hidden />
              {pending
                ? "Compartiendo…"
                : !ready
                  ? "Preparando PDF…"
                  : "Compartir PDF"}
            </button>
          </div>
        </div>
        {error ? (
          <p className="mx-auto mt-2 max-w-3xl text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {fallbackOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="share-fallback-title"
            className="w-full max-w-md rounded-lg border border-border bg-surface-elevated p-5 shadow-lg"
          >
            <h2
              id="share-fallback-title"
              className="font-display text-lg tracking-tight"
            >
              Compartir PDF
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Este navegador no abre el menú de compartir con archivos. Descargá
              el PDF y adjuntarlo en WhatsApp o el mail con el clip.
            </p>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-muted-foreground">
                Teléfono WhatsApp (opcional)
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 11 5555-5555"
                className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
              />
            </label>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-muted-foreground">Correo</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="destino@ejemplo.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
              />
            </label>

            {error ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={openWhatsAppFallback}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp + descargar PDF
              </button>
              <button
                type="button"
                onClick={openMailFallback}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <Mail className="size-4" aria-hidden />
                Mail + descargar PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileRef.current) triggerDownload(fileRef.current);
                }}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                Solo descargar PDF
              </button>
              <button
                type="button"
                onClick={() => setFallbackOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
