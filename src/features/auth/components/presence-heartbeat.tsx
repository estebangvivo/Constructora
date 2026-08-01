"use client";

import { useEffect } from "react";

const INTERVAL_MS = 45_000;

/** Ping periódico para marcar al usuario como en línea. */
export function PresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    async function beat() {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        await fetch("/api/presence/heartbeat", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        // silencioso: no bloquear la UI
      }
    }

    void beat();
    const id = window.setInterval(() => void beat(), INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
