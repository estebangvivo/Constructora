"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import {
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
  const scrollerRef = useRef<HTMLElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function updateOverflow() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    el.addEventListener("scroll", updateOverflow, { passive: true });
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    window.addEventListener("resize", updateOverflow);
    return () => {
      el.removeEventListener("scroll", updateOverflow);
      ro.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [items.length]);

  function scrollByDir(dir: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  return (
    <div className="relative border-b border-border bg-surface">
      {canLeft && (
        <button
          type="button"
          aria-label="Ver módulos anteriores"
          onClick={() => scrollByDir(-1)}
          className="absolute left-0 top-0 z-10 flex h-full w-9 items-center justify-center bg-gradient-to-r from-surface via-surface/95 to-transparent text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Ver más módulos"
          onClick={() => scrollByDir(1)}
          className="absolute right-0 top-0 z-10 flex h-full w-9 items-center justify-center bg-gradient-to-l from-surface via-surface/95 to-transparent text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      <nav
        ref={scrollerRef}
        className={cn(
          "flex gap-1 overflow-x-auto overscroll-x-contain px-3 pb-1 pt-0 md:px-4 lg:px-6",
          "scroll-smooth",
          /* Barrita visible en PC (Firefox + Chromium) */
          "[scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]",
          "[&::-webkit-scrollbar]:h-2",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
          "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40",
          canLeft && "pl-10",
          canRight && "pr-10",
        )}
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
            <a
              key={href}
              href={href}
              className={cn(
                "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3.5 text-sm transition-colors",
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
            </a>
          );
        })}
      </nav>
    </div>
  );
}
