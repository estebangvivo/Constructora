"use client";

import { useEffect } from "react";

/**
 * Amazon Silk / Fire: el client router de Next a menudo intercepta el click
 * (preventDefault) y falla al navegar → los links “no hacen nada”.
 * En esos navegadores forzamos carga completa vía location.assign.
 */
function isLegacyTabletBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Silk/i.test(ua) ||
    /KF[A-Z][A-Z0-9]+/i.test(ua) || // Fire tablet models (KFSUWI, KFTBWI, …)
    (/Android/i.test(ua) && /Amazon/i.test(ua))
  );
}

function isAppPath(href: string) {
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  if (href.startsWith("javascript:")) return false;
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function HardNavForLegacy() {
  useEffect(() => {
    if (!isLegacyTabletBrowser()) return;

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || !isAppPath(href)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(anchor.href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
