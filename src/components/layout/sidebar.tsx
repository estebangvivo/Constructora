"use client";

import { HardHat, LogOut } from "lucide-react";
import { SIDEBAR_NAV, filterNavByAccess } from "@/config/navigation";
import { logoutLocal } from "@/features/auth/actions/auth-actions";
import { NotificationsBell } from "@/features/notifications/components/notifications-bell";
import { OperadorSidebarWidget } from "@/features/turnero/components/operador-sidebar-widget";
import type { AppModuleKey } from "@/features/auth/lib/modules";
import type { AppRole } from "@/types";
import { cn } from "@/lib/utils";

type SidebarProps = {
  pathname: string;
  role?: AppRole | null;
  modules?: AppModuleKey[] | string[] | null;
  organizationName?: string | null;
  logoUrl?: string | null;
  showLogout?: boolean;
};

export function Sidebar({
  pathname,
  role = null,
  modules = null,
  organizationName,
  logoUrl,
  showLogout = true,
}: SidebarProps) {
  const items = filterNavByAccess(SIDEBAR_NAV, { role, modules });

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground print:hidden md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-7 rounded object-contain"
          />
        ) : (
          <HardHat className="size-5" aria-hidden />
        )}
        <span className="truncate font-display text-lg tracking-tight">
          {organizationName ?? "Constructora"}
        </span>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
        aria-label="Principal"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-active font-medium text-sidebar-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.title}
            </a>
          );
        })}
        <div className="pt-3">
          <OperadorSidebarWidget />
        </div>
      </nav>

      {showLogout && (
        <div className="shrink-0 border-t border-border p-3">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs text-sidebar-foreground/50">Avisos</span>
            <NotificationsBell variant="sidebar" />
          </div>
          <form action={logoutLocal}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
