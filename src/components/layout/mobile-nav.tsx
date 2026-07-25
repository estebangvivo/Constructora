"use client";

import { usePathname } from "next/navigation";
import { HardHat, LogOut, Menu } from "lucide-react";
import { SIDEBAR_NAV, filterNavByAccess } from "@/config/navigation";
import { logoutLocal } from "@/features/auth/actions/auth-actions";
import type { AppModuleKey } from "@/features/auth/lib/modules";
import type { AppRole } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

type MobileNavProps = {
  role?: AppRole | null;
  modules?: AppModuleKey[] | string[] | null;
  organizationName?: string | null;
  logoUrl?: string | null;
};

export function MobileNav({
  role = null,
  modules = null,
  organizationName,
  logoUrl,
}: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = filterNavByAccess(SIDEBAR_NAV, { role, modules });

  return (
    <div className="border-b border-border bg-sidebar text-sidebar-foreground md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <a href="/" className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="size-7 shrink-0 rounded object-contain"
            />
          ) : (
            <HardHat className="size-5 shrink-0" aria-hidden />
          )}
          <span className="truncate font-display text-lg tracking-tight">
            {organizationName ?? "Constructora"}
          </span>
        </a>
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
