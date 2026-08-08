"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "simpleobra.pwaInstallDismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Banner “Instalar app” cuando Chrome dispara beforeinstallprompt. */
export function PwaInstallBanner() {
  const [ready, setReady] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [hidden, setHidden] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      Boolean(navigator.standalone);

    setIsIos(ios);
    setStandalone(isStandalone);
    setHidden(isStandalone || readDismissed());
    setReady(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    if (dontShowAgain) writeDismissed();
    setHidden(true);
    setDeferred(null);
  }

  if (!ready || standalone || hidden) return null;

  const showAndroid = Boolean(deferred);
  const showIos = isIos && !deferred;
  if (!showAndroid && !showIos) return null;

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-[80] mx-auto max-w-md sm:bottom-4"
      role="dialog"
      aria-label="Instalar aplicación"
    >
      <div className="rounded-lg border border-border bg-surface-elevated p-3.5 shadow-xl">
        <p className="text-sm font-medium text-foreground">
          {showIos
            ? "Agregar a pantalla de inicio"
            : "Instalá SimpleObra en el celular"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {showIos
            ? "En Safari: Compartir → “Agregar a pantalla de inicio”."
            : "Acceso rápido a Datos en Obra, como una app."}
        </p>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="size-3.5 accent-[var(--accent)]"
          />
          No volver a mostrar
        </label>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            onClick={dismiss}
          >
            Ahora no
          </button>
          {showAndroid && deferred ? (
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                writeDismissed();
                setHidden(true);
                setDeferred(null);
              }}
            >
              Instalar
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
              onClick={dismiss}
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
