"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileDown,
  Mail,
  MessageCircle,
  Paperclip,
  Printer,
} from "lucide-react";
import {
  buildMailtoShareUrl,
  buildTreasuryShareMessage,
  buildTreasuryShareSubject,
  buildWhatsAppShareUrl,
  type ShareTreasuryDocInput,
} from "@/features/treasury/lib/share-message";

type ShareTreasuryDocButtonProps = {
  doc: ShareTreasuryDocInput;
  pdfUrl: string;
  printHref: string;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
};

type Channel = "whatsapp" | "email";
type Phase = "form" | "attach";

async function fetchPdfFile(pdfUrl: string, filename: string): Promise<File> {
  const res = await fetch(pdfUrl, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error("No se pudo generar el PDF.");
  }
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

function pdfFilename(doc: ShareTreasuryDocInput) {
  const safe = doc.number.replace(/[^\w.-]+/g, "_");
  return doc.kind === "receipt"
    ? `recibo-${safe}.pdf`
    : `orden-pago-${safe}.pdf`;
}

function canShareFile(file: File): boolean {
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
  return true;
}

export function ShareTreasuryDocButton({
  doc,
  pdfUrl,
  printHref,
  defaultPhone,
  defaultEmail,
}: ShareTreasuryDocButtonProps) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [readyFileName, setReadyFileName] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const message = buildTreasuryShareMessage(doc);
  const subject = buildTreasuryShareSubject(doc);
  const filename = pdfFilename(doc);

  useEffect(() => {
    let cancelled = false;
    fileRef.current = null;
    setPdfReady(false);
    void (async () => {
      try {
        const file = await fetchPdfFile(pdfUrl, filename);
        if (cancelled) return;
        fileRef.current = file;
        setPdfReady(true);
      } catch {
        // se reintenta al confirmar
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, filename]);

  function resetDialog() {
    setChannel(null);
    setPhase("form");
    setError(null);
    setReadyFileName(null);
    setPending(false);
  }

  function openChannel(next: Channel) {
    setError(null);
    setPhase("form");
    setReadyFileName(null);
    setPhone(defaultPhone ?? "");
    setEmail(defaultEmail ?? "");
    setChannel(next);
  }

  async function downloadPdfOnly() {
    setError(null);
    setPending(true);
    try {
      const file = fileRef.current ?? (await fetchPdfFile(pdfUrl, filename));
      fileRef.current = file;
      setPdfReady(true);
      triggerDownload(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el PDF.");
    } finally {
      setPending(false);
    }
  }

  async function onConfirm() {
    setError(null);
    setPending(true);
    try {
      const file = fileRef.current ?? (await fetchPdfFile(pdfUrl, filename));
      fileRef.current = file;
      setPdfReady(true);

      if (channel === "whatsapp" || channel === "email") {
        if (canShareFile(file)) {
          try {
            await navigator.share({ files: [file], title: subject });
            resetDialog();
            return;
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
          }
        }

        if (channel === "email") {
          const trimmed = email.trim();
          if (!trimmed) {
            setError("Indicá un correo de destino.");
            return;
          }
          if (!trimmed.includes("@")) {
            setError("El correo no parece válido.");
            return;
          }
        }

        triggerDownload(file);
        setReadyFileName(file.name);
        setPhase("attach");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar el envío.");
    } finally {
      setPending(false);
    }
  }

  function openWhatsAppWithText() {
    const url = buildWhatsAppShareUrl(
      phone,
      `${message}\n\nTe envío el PDF ${readyFileName ?? filename} (adjuntarlo con el clip).`,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openMailWithText() {
    const trimmed = email.trim();
    window.location.href = buildMailtoShareUrl(
      trimmed,
      subject,
      `${message}\n\nAdjuntá el archivo descargado: ${readyFileName ?? filename}`,
    );
  }

  return (
    <>
      <Link
        href={printHref}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
      >
        <Printer className="size-4" aria-hidden />
        Imprimir
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => void downloadPdfOnly()}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
      >
        <Download className="size-4" aria-hidden />
        PDF
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => openChannel("whatsapp")}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
      >
        <MessageCircle className="size-4" aria-hidden />
        WhatsApp
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => openChannel("email")}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
      >
        <Mail className="size-4" aria-hidden />
        Mail
      </button>

      {error && !channel ? (
        <p className="basis-full text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {channel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="share-treasury-title"
            className="w-full max-w-md rounded-lg border border-border bg-surface-elevated p-5 shadow-lg"
          >
            {phase === "form" ? (
              <>
                <h2
                  id="share-treasury-title"
                  className="font-display text-lg tracking-tight"
                >
                  {channel === "whatsapp"
                    ? "Enviar por WhatsApp"
                    : "Enviar por mail"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pdfReady
                    ? "PDF listo. En el celular debería abrirse el menú para elegir WhatsApp con el archivo."
                    : "Preparando el PDF…"}{" "}
                  En la PC hay que adjuntarlo con el clip.
                </p>

                {channel === "whatsapp" ? (
                  <label className="mt-4 block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Teléfono (opcional)
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej. 11 5555-5555"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    />
                  </label>
                ) : (
                  <label className="mt-4 block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Correo
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="destino@ejemplo.com"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
                    />
                  </label>
                )}

                <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <FileDown className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    PDF: <span className="text-foreground">{filename}</span>
                    {pdfReady ? " · listo" : " · preparando…"}
                  </span>
                </div>

                <pre className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground">
                  {message}
                </pre>

                {error ? (
                  <p className="mt-3 text-sm text-danger" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={resetDialog}
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pending || !pdfReady}
                    onClick={() => void onConfirm()}
                    className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
                  >
                    {pending
                      ? "Compartiendo…"
                      : !pdfReady
                        ? "Preparando…"
                        : "Continuar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="share-treasury-title"
                  className="font-display text-lg tracking-tight"
                >
                  Adjuntá el PDF
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Este navegador no puede mandar el archivo solo. El PDF ya se
                  descargó: adjuntarlo con el clip en el chat o el mail.
                </p>

                <div className="mt-4 space-y-3 rounded-md border border-accent/30 bg-accent/10 p-4 text-sm">
                  <p className="flex items-start gap-2 font-medium text-foreground">
                    <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      Archivo:{" "}
                      <span className="tabular-nums">
                        {readyFileName ?? filename}
                      </span>
                    </span>
                  </p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                    <li>Abrí el chat</li>
                    <li>Tocá el clip / adjuntar</li>
                    <li>Elegí {readyFileName ?? filename}</li>
                    <li>Enviá</li>
                  </ol>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={resetDialog}
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    Listo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (channel === "whatsapp") openWhatsAppWithText();
                      else openMailWithText();
                    }}
                    className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
                  >
                    {channel === "whatsapp"
                      ? "Abrir WhatsApp"
                      : "Abrir correo"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
