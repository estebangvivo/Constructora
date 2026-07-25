"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FIELD_SHORTCUTS,
  PROJECT_NAV,
  filterNavByAccess,
  projectHref,
} from "@/config/navigation";
import type { AppModuleKey } from "@/features/auth/lib/modules";
import type { AppRole } from "@/types";
import { cn } from "@/lib/utils";

type ProjectNavProps = {
  projectId: string;
  role?: AppRole | null;
  modules?: AppModuleKey[] | string[] | null;
};

export function ProjectNav({
  projectId,
  role = null,
  modules = null,
}: ProjectNavProps) {
  const pathname = usePathname();
  const items = filterNavByAccess(PROJECT_NAV, { role, modules });
  const fieldItems = filterNavByAccess(FIELD_SHORTCUTS, { role, modules });

  return (
    <div className="border-b border-border bg-surface">
      <nav
        className="hidden gap-1 overflow-x-auto px-4 md:flex lg:px-6"
        aria-label="Módulos de la obra"
      >
        {items.map((item) => {
          const href = projectHref(projectId, item.href);
          const active =
            item.href === ""
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm transition-colors",
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {item.title}
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      <nav
        className="grid grid-cols-2 gap-2 p-3 md:hidden"
        aria-label="Accesos de campo"
      >
        {fieldItems.map((item) => {
          const href = projectHref(projectId, item.href);
          const Icon = item.icon;
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-3 text-sm font-medium",
                active
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.title}
            </Link>
          );
        })}
        <Link
          href={projectHref(projectId)}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-3 text-sm text-muted-foreground"
        >
          Más módulos…
        </Link>
      </nav>
    </div>
  );
}
