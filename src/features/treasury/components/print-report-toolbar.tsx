"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, MessageCircle, Printer } from "lucide-react";
import { sendTreasuryPdfViaWhatsApp } from "@/features/treasury/actions/whatsapp-send-actions";

type PrintReportToolbarProps = {
  backHref: string;
  backLabel: string;
  kind: "receipt" | "payment-order";
  documentId: string;
  pdfUrl: string;
  filename: string;
  shareTitle?: string;
  defaultPhone?: string | null;
  cloudEnabled: boolean;
};

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return (
    navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1
  );
}

function canShareFiles(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare === "function") {
    try {
      const probe = new File([new Uint8Array([37, 80, 68, 70])], "t.pdf", {
        type: "application/pdf",
      });
      return navigator.canShare({ files: [probe] });
    } catch {
      return true;
    }
  }
  return true;
}

async function fetchPdfFile(pdfUrl: string, filename: string): Promise<File> {
  const res = await fetch(pdfUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error("No se pudo generar el PDF.");
  const blob = await res.blob();
  return new File([blob], filename, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}

function triggerAnchorDownload(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Abre la app WhatsApp sin chat forzado.
 * Chrome Android falla con wa.me vacío y con api.whatsapp.com/send sin ?text=
 */
function openWhatsAppApp() {
  const hint = encodeURIComponent(
    "Adjuntá el PDF con el clip → Documento (Descargas)",
  );
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  // Scheme nativo en móvil: no dispara el error de "enlace de este chat"
  if (/Android|iPhone|iPad|iPod/i.test(ua)) {
    window.location.href = `whatsapp://send?text=${hint}`;
    return;
  }
  window.location.href = `https://api.whatsapp.com/send?text=${hint}`;
}

function sharePdfInUserGesture(
  file: File,
  title: string,
): Promise<"ok" | "abort" | "fail"> {
  if (typeof navigator.share !== "function") {
    return Promise.resolve("fail");
  }
  return navigator
    .share({ files: [file], title })
    .then(() => "ok" as const)
    .catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "AbortError") {
        return "abort" as const;
      }
      return navigator
        .share({ files: [file] })
        .then(() => "ok" as const)
        .catch((e2: unknown) => {
          if (e2 instanceof DOMException && e2.name === "AbortError") {
            return "abort" as const;
          }
          return "fail" as const;
        });
    });
}

export function PrintReportToolbar({
  backHref,
  backLabel,
  kind,
  documentId,
  pdfUrl,
  filename,
  shareTitle,
  defaultPhone,
  cloudEnabled,
}: PrintReportToolbarProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [waSheetOpen, setWaSheetOpen] = useState(false);
  const [filesShareOk, setFilesShareOk] = useState(false);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    setFilesShareOk(canShareFiles());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPdfReady(false);
    fileRef.current = null;
    void (async () => {
      try {
        const file = await fetchPdfFile(pdfUrl, filename);
        if (cancelled) return;
        fileRef.current = file;
        setPdfReady(true);
      } catch {
        if (!cancelled) {
          setError("No se pudo preparar el PDF. Probá recargar la página.");
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
    setPdfReady(true);
    return file;
  }

  async function onDownloadPdf() {
    setError(null);
    setSuccess(null);
    setStatus(null);
    setDownloading(true);
    try {
      const file = await ensureFile();

      if (isAppleTouchDevice()) {
        const result = await sharePdfInUserGesture(file, shareTitle || filename);
        if (result === "ok" || result === "abort") {
          if (result === "ok") {
            setSuccess(
              "En el menú elegí «Guardar en Archivos» para guardar el PDF.",
            );
          }
          return;
        }
        const url = URL.createObjectURL(file);
        window.open(url, "_blank", "noopener,noreferrer");
        setSuccess(
          "Se abrió el PDF. Tocá compartir del visor y «Guardar en Archivos».",
        );
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        return;
      }

      triggerAnchorDownload(file);
      setSuccess("PDF descargado. Buscalo en Descargas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el PDF.");
    } finally {
      setDownloading(false);
    }
  }

  /** Descarga (si hay PDF) y abre WhatsApp en el mismo toque. */
  function downloadAndOpenWhatsApp() {
    const file = fileRef.current;
    if (file) triggerAnchorDownload(file);
    openWhatsAppApp();
    setSuccess(
      `WhatsApp abierto. Elegí el chat → clip 📎 → Documento → ${filename}`,
    );
  }

  function onWhatsApp() {
    setError(null);
    setSuccess(null);
    setStatus(null);
    setPhone((prev) => defaultPhone ?? prev);

    if (cloudEnabled) {
      setWaSheetOpen(true);
      return;
    }

    // Sin HTTPS: abrir WhatsApp YA (mismo toque). No solo un panel.
    if (!filesShareOk) {
      downloadAndOpenWhatsApp();
      return;
    }

    const file = fileRef.current;
    if (!file) {
      // Sin archivo aún: igual abrir WhatsApp; el PDF se puede descargar aparte
      downloadAndOpenWhatsApp();
      setStatus("Si el PDF no bajó, tocá «Descargar PDF» y adjuntarlo con el clip.");
      return;
    }

    setPendingShare(true);
    void sharePdfInUserGesture(file, shareTitle || filename).then((result) => {
      setPendingShare(false);
      if (result === "ok") {
        setSuccess("Elegí WhatsApp: el PDF se envía como documento adjunto.");
        return;
      }
      if (result === "abort") return;
      downloadAndOpenWhatsApp();
    });
  }

  function onConfirmWhatsAppFromSheet() {
    setError(null);
    setSuccess(null);

    if (!cloudEnabled) {
      setWaSheetOpen(false);
      downloadAndOpenWhatsApp();
      return;
    }

    if (!phone.trim()) {
      setError("Indicá el teléfono de WhatsApp del destinatario.");
      return;
    }
    setPendingShare(true);
    setStatus("Enviando PDF…");
    void sendTreasuryPdfViaWhatsApp({
      kind,
      id: documentId,
      phone,
    }).then((result) => {
      setPendingShare(false);
      setStatus(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("PDF enviado como documento por WhatsApp.");
      setWaSheetOpen(false);
    });
  }

  const busy = downloading || pendingShare;

  const feedback = (
    <>
      {!cloudEnabled && !filesShareOk && !success ? (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          WhatsApp descarga el PDF y abre el chat. Adjuntá con clip 📎 →
          Documento (desde HTTP el celular no puede adjuntar solo).
        </p>
      ) : null}
      {status ? (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-success" role="status">
          {success}
        </p>
      ) : null}
    </>
  );

  const actions = (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => window.print()}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2.5 text-sm hover:bg-surface disabled:opacity-60 sm:flex-none"
      >
        <Printer className="size-4" aria-hidden />
        Imprimir
      </button>
      <button
        type="button"
        disabled={busy || !pdfReady}
        onClick={() => void onDownloadPdf()}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2.5 text-sm font-medium text-background disabled:opacity-60 sm:flex-none"
      >
        <Download className="size-4" aria-hidden />
        {downloading ? "Descargando…" : "Descargar PDF"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onWhatsApp}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#128C7E] px-3 py-2.5 text-sm font-medium text-white hover:bg-[#0e6b60] disabled:opacity-60 sm:flex-none"
      >
        <MessageCircle className="size-4" aria-hidden />
        {pendingShare ? "Abriendo…" : "WhatsApp"}
      </button>
    </>
  );

  return (
    <>
      <div className="print:hidden sticky top-0 z-20 border-b border-border bg-surface-elevated/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {backLabel}
            </Link>
            <div className="hidden flex-wrap gap-2 sm:flex">{actions}</div>
          </div>
          <div className="hidden sm:block">{feedback}</div>
          {!pdfReady && !error ? (
            <p className="hidden text-xs text-muted-foreground sm:block">
              Preparando PDF…
            </p>
          ) : null}
        </div>
      </div>

      <div className="print:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-elevated p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="mb-2 space-y-1">{feedback}</div>
        <div className="flex gap-2">{actions}</div>
      </div>

      {waSheetOpen && cloudEnabled ? (
        <div className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="wa-sheet-title"
            className="w-full max-w-md rounded-lg border border-border bg-surface-elevated p-5 shadow-lg"
          >
            <h2
              id="wa-sheet-title"
              className="font-display text-lg tracking-tight"
            >
              Enviar PDF por WhatsApp
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Se enviará el PDF como documento adjunto.
            </p>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-muted-foreground">Teléfono</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 11 5555-5555"
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
                disabled={pendingShare}
                onClick={onConfirmWhatsAppFromSheet}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#128C7E] px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                <MessageCircle className="size-4" aria-hidden />
                {pendingShare ? "Enviando…" : "Enviar PDF adjunto"}
              </button>
              <button
                type="button"
                disabled={pendingShare}
                onClick={() => setWaSheetOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
