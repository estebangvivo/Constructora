"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  unreadCount: number;
  items: NotificationItem[];
};

const PANEL_WIDTH = 320;

function tiempoRelativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

export function NotificationsBell({
  className,
  variant = "sidebar",
}: {
  className?: string;
  variant?: "sidebar" | "mobile";
}) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const cargar = useCallback(async (withItems: boolean) => {
    try {
      if (withItems) setLoading(true);
      const url = withItems
        ? "/api/notifications?limit=20"
        : "/api/notifications?limit=1";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as NotificationsResponse;
      setUnreadCount(data.unreadCount);
      if (withItems) setItems(data.items);
    } catch {
      /* silencioso */
    } finally {
      if (withItems) setLoading(false);
    }
  }, []);

  const placePanel = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const gap = 8;
    const maxLeft = window.innerWidth - PANEL_WIDTH - 16;

    if (variant === "mobile") {
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + gap,
        left: Math.max(16, Math.min(rect.right - PANEL_WIDTH, maxLeft)),
        width: PANEL_WIDTH,
      });
      return;
    }

    // Sidebar: abrir hacia la derecha del botón, anclado abajo (sin recorte del aside).
    let left = rect.right + gap;
    if (left > maxLeft) {
      left = Math.max(16, rect.left - PANEL_WIDTH - gap);
    }
    setPanelStyle({
      position: "fixed",
      bottom: Math.max(16, window.innerHeight - rect.bottom),
      left,
      width: PANEL_WIDTH,
    });
  }, [variant]);

  useEffect(() => {
    void cargar(false);
    const id = window.setInterval(() => void cargar(false), 20_000);
    return () => window.clearInterval(id);
  }, [cargar]);

  useEffect(() => {
    if (!open) return;
    void cargar(true);
  }, [open, cargar]);

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    function onResize() {
      placePanel();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, placePanel]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      const panel = document.getElementById("notifications-panel");
      if (panel?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function marcarLeidas(ids?: string[]) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
      await cargar(true);
    } catch {
      /* ignore */
    }
  }

  async function abrirItem(item: NotificationItem) {
    if (!item.readAt) await marcarLeidas([item.id]);
    setOpen(false);
    if (item.href) window.location.href = item.href;
  }

  const panel = open && mounted && (
    <div
      id="notifications-panel"
      style={panelStyle}
      className="z-[80] overflow-hidden rounded-lg border border-border bg-surface text-foreground shadow-xl"
      role="dialog"
      aria-label="Notificaciones"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <p className="text-sm font-medium">Notificaciones</p>
        {unreadCount > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void marcarLeidas()}
          >
            Marcar todas leídas
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Cargando…
          </p>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No hay notificaciones
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void abrirItem(item)}
                      className={cn(
                        "w-full border-l-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                        item.readAt
                          ? "border-l-transparent"
                          : "border-l-accent bg-muted/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                          {item.title}
                        </p>
                        {!item.readAt && (
                          <span
                            className="mt-1 size-1.5 shrink-0 rounded-full bg-accent"
                            aria-hidden
                          />
                        )}
                      </div>
                      <p className="mt-0.5 break-words text-xs text-foreground/70 line-clamp-2">
                        {item.body}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {tiempoRelativo(item.createdAt)}
                      </p>
                    </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative rounded-md p-2 transition-colors",
          variant === "sidebar"
            ? "text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground",
        )}
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : "Notificaciones"
        }
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
