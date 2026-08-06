"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, MapPinned, TriangleAlert } from "lucide-react";
import { projectHref } from "@/config/navigation";

/**
 * Barra inferior fija en móvil cuando estás dentro de una obra en rutas de campo.
 */
export function FieldBottomNav() {
  const pathname = usePathname() ?? "";
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (!match) return null;

  const projectId = match[1];
  const onDaily = pathname.includes("/daily-report");
  const onPunch = pathname.includes("/punch-list");
  const show = onDaily || onPunch;
  if (!show) return null;

  const itemClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
      active ? "text-accent" : "text-muted-foreground"
    }`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Atajos Datos en Obra"
    >
      <div className="mx-auto flex max-w-lg">
        <Link href="/campo" className={itemClass(false)}>
          <MapPinned className="size-5" aria-hidden />
          Obras
        </Link>
        <Link
          href={projectHref(projectId, "/daily-report")}
          className={itemClass(onDaily)}
        >
          <ClipboardList className="size-5" aria-hidden />
          Parte
        </Link>
        <Link
          href={projectHref(projectId, "/punch-list")}
          className={itemClass(onPunch)}
        >
          <TriangleAlert className="size-5" aria-hidden />
          Punch
        </Link>
      </div>
    </nav>
  );
}
