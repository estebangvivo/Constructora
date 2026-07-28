"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { AppModuleKey } from "@/features/auth/lib/modules";
import type { AppRole } from "@/types";

type DashboardShellProps = {
  children: React.ReactNode;
  role?: AppRole | null;
  modules?: AppModuleKey[] | string[] | null;
  organizationName?: string | null;
  logoUrl?: string | null;
};

export function DashboardShell({
  children,
  role = null,
  modules = null,
  organizationName,
  logoUrl,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar
        pathname={pathname}
        role={role}
        modules={modules}
        organizationName={organizationName}
        logoUrl={logoUrl}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileNav
          role={role}
          modules={modules}
          organizationName={organizationName}
          logoUrl={logoUrl}
        />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0">
          {children}
        </main>
      </div>
    </div>
  );
}
