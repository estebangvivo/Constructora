"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);

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
      /* silencioso: la campana no debe romper el shell */
    } finally {
      if (withItems) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar(false);
    const id = window.setInterval(() => void cargar(false), 20_000);
    return () => window.clearInterval(id);
  }, [cargar]);

  useEffect(() => {
    if (!open) return;
    void cargar(true);
  }, [open, cargar]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  const panelSide =
    variant === "mobile"
      ? "right-0 top-full mt-2"
      : "left-0 bottom-full mb-2 md:left-auto md:right-0";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
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

      {open && (
        <div
          className={cn(
            "absolute z-50 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-md border border-border bg-surface text-foreground shadow-lg",
            panelSide,
          )}
          role="dialog"
          aria-label="Notificaciones"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
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
                        "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                        !item.readAt && "bg-accent/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">
                          {item.title}
                        </p>
                        {!item.readAt && (
                          <span
                            className="mt-1 size-1.5 shrink-0 rounded-full bg-accent"
                            aria-hidden
                          />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {item.body}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {tiempoRelativo(item.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
