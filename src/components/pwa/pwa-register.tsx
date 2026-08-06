"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA (solo en producción o si se fuerza). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // En local también sirve para probar “Agregar a inicio”
    const ready = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore */
      });
    };
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
  }, []);

  return null;
}
