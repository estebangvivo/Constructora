"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Banner “Instalar app” cuando Chrome dispara beforeinstallprompt. */
export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIos(ios);
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error iOS Safari
        Boolean(navigator.standalone),
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed) return null;

  if (deferred) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-md rounded-lg border border-border bg-card p-3 shadow-lg sm:bottom-4">
        <p className="text-sm font-medium">Instalá SimpleObra en el celular</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Acceso rápido a Datos en Obra, como una app.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground"
            onClick={() => setDismissed(true)}
          >
            Ahora no
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
          >
            Instalar
          </button>
        </div>
      </div>
    );
  }

  if (isIos) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-md rounded-lg border border-border bg-card p-3 shadow-lg sm:bottom-4">
        <p className="text-sm font-medium">Agregar a pantalla de inicio</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          En Safari: Compartir → “Agregar a pantalla de inicio”.
        </p>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground"
            onClick={() => setDismissed(true)}
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return null;
}
