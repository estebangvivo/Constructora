"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { logoutLocal } from "@/features/auth/actions/auth-actions";

const ACTIVITY_PING_MS = 30_000;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

type SessionIdleGuardProps = {
  /** Minutos sin interacción antes de cerrar sesión (5–480). */
  idleMinutes: number;
};

/**
 * Cierra la sesión si no hay interacción del usuario durante `idleMinutes`.
 * También avisa al servidor para validar idle en el backend.
 */
export function SessionIdleGuard({ idleMinutes }: SessionIdleGuardProps) {
  const router = useRouter();
  const lastPingRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    const minutes = Math.min(480, Math.max(5, idleMinutes || 30));
    const idleMs = minutes * 60_000;
    let idleTimer: number | null = null;

    async function logoutIdle() {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      try {
        await logoutLocal();
      } catch {
        router.replace("/sign-in?reason=idle");
      }
    }

    function resetIdleTimer() {
      if (idleTimer != null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => void logoutIdle(), idleMs);
    }

    async function pingActivity() {
      const now = Date.now();
      if (now - lastPingRef.current < ACTIVITY_PING_MS) return;
      lastPingRef.current = now;
      try {
        const res = await fetch("/api/presence/activity", {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.status === 401) void logoutIdle();
      } catch {
        // silencioso
      }
    }

    function onActivity() {
      if (document.visibilityState === "hidden") return;
      resetIdleTimer();
      void pingActivity();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") onActivity();
    }

    resetIdleTimer();
    void pingActivity();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (idleTimer != null) window.clearTimeout(idleTimer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [idleMinutes, router]);

  return null;
}
