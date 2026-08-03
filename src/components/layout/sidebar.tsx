"use client";

import { LogOut, Building2 } from "lucide-react";
import { SIDEBAR_NAV, filterNavByAccess } from "@/config/navigation";
import { APP_NAME } from "@/config/brand";
import { OrgBrandMark } from "@/components/brand/org-brand-mark";
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
  userEmail?: string | null;
  showLogout?: boolean;
  isPlatformSuperadmin?: boolean;
};

export function Sidebar({
  pathname,
  role = null,
  modules = null,
  organizationName,
  logoUrl,
  userEmail,
  showLogout = true,
  isPlatformSuperadmin = false,
}: SidebarProps) {
  const items = filterNavByAccess(SIDEBAR_NAV, {
    role,
    modules,
    isPlatformSuperadmin,
  });

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground print:hidden md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <OrgBrandMark
          logoUrl={logoUrl}
          className="size-8 shrink-0 object-contain"
          orgClassName="rounded-md bg-white/95 p-0.5"
        />
        <div className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg tracking-tight">
            {organizationName ?? APP_NAME}
          </span>
          <a
            href="/select-organization"
            className="text-[11px] text-sidebar-foreground/55 hover:text-sidebar-foreground"
          >
            Cambiar empresa
          </a>
        </div>
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
          {userEmail ? (
            <p
              className="mb-1 truncate px-3 text-xs text-sidebar-foreground/55"
              title={userEmail}
            >
              {userEmail}
            </p>
          ) : null}
          <form action={logoutLocal}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Cerrar sesión
            </button>
          </form>
          <a
            href="/select-organization"
            className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            <Building2 className="size-4 shrink-0" aria-hidden />
            Empresas
          </a>
        </div>
      )}
    </aside>
  );
}
