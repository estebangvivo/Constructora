"use client";

import { usePathname } from "next/navigation";
import { LogOut, Menu, Building2 } from "lucide-react";
import { SIDEBAR_NAV, filterNavByAccess } from "@/config/navigation";
import { APP_NAME } from "@/config/brand";
import { OrgBrandMark } from "@/components/brand/org-brand-mark";
import { logoutLocal } from "@/features/auth/actions/auth-actions";
import { NotificationsBell } from "@/features/notifications/components/notifications-bell";
import type { AppModuleKey } from "@/features/auth/lib/modules";
import type { AppRole } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

type MobileNavProps = {
  role?: AppRole | null;
  modules?: AppModuleKey[] | string[] | null;
  organizationName?: string | null;
  logoUrl?: string | null;
  userEmail?: string | null;
  isPlatformSuperadmin?: boolean;
};

export function MobileNav({
  role = null,
  modules = null,
  organizationName,
  logoUrl,
  userEmail,
  isPlatformSuperadmin = false,
}: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = filterNavByAccess(SIDEBAR_NAV, {
    role,
    modules,
    isPlatformSuperadmin,
  });

  return (
    <div className="border-b border-border bg-sidebar text-sidebar-foreground print:hidden md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
          <a href="/" className="flex min-w-0 items-center gap-2">
          <OrgBrandMark
            logoUrl={logoUrl}
            className="size-8 shrink-0 object-contain"
            orgClassName="rounded-md bg-white/95 p-0.5"
          />
          <span className="min-w-0">
            <span className="block truncate font-display text-lg tracking-tight">
              {organizationName ?? APP_NAME}
            </span>
          </span>
        </a>
        <div className="flex shrink-0 items-center gap-1">
          <NotificationsBell variant="mobile" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-2 text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            aria-expanded={open}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="flex flex-col gap-1 border-t border-border p-3"
          aria-label="Principal"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm",
                  active
                    ? "bg-sidebar-active font-medium text-sidebar-foreground"
                    : "text-sidebar-foreground/75",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.title}
              </a>
            );
          })}
          <a
            href="/select-organization"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/75"
          >
            <Building2 className="size-4" aria-hidden />
            Cambiar empresa
          </a>
          {userEmail ? (
            <p
              className="truncate px-3 pt-1 text-xs text-sidebar-foreground/55"
              title={userEmail}
            >
              {userEmail}
            </p>
          ) : null}
          <form action={logoutLocal}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/75"
            >
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
