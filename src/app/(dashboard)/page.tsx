import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isDevAuthBypass } from "@/lib/auth-config";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { SIDEBAR_NAV, filterNavByAccess } from "@/config/navigation";
import { getOrganizationProfile } from "@/features/settings/queries/get-organization";
import { organizationLogoSrc } from "@/features/settings/lib/organization-logo";
import { getHomeDashboardData } from "@/features/dashboard/queries/get-home-dashboard";
import { HomeDashboard } from "@/features/dashboard/components/home-dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

function parseDateParam(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function HomePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (
    session &&
    isPlatformSuperadmin(session) &&
    !session.organizationId
  ) {
    redirect("/admin");
  }

  const { from, to } = await searchParams;
  const modules = session?.allowedModules ?? [];
  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to);
  const validRange =
    fromDate && toDate && fromDate.getTime() > toDate.getTime()
      ? { from: toDate, to: fromDate }
      : { from: fromDate, to: toDate };

  const [organization, dashboard] = await Promise.all([
    session ? getOrganizationProfile() : Promise.resolve(null),
    session ? getHomeDashboardData(modules, validRange) : Promise.resolve(null),
  ]);
  const logoUrl = organizationLogoSrc(organization?.logoUrl);

  const navModules = filterNavByAccess(
    SIDEBAR_NAV.filter((item) => item.href !== "/"),
    {
      role: session?.role ?? null,
      modules: session?.allowedModules ?? null,
      isPlatformSuperadmin: session
        ? isPlatformSuperadmin(session)
        : false,
    },
  );

  return (
    <div className="px-4 py-8 lg:px-6">
      <div className="mb-8 flex flex-wrap items-end gap-4">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-14 rounded-md border border-border object-contain bg-surface p-1"
          />
        )}
        <div>
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">
            {organization?.name ?? "Panel de control"}
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            {session
              ? `Hola${session.user.firstName ? `, ${session.user.firstName}` : ""}. Resumen del negocio y acceso a cada módulo.`
              : "Gestión de obras, presupuesto, campo y logística."}
          </p>
        </div>
      </div>

      {isDevAuthBypass() && (
        <p className="mb-6 inline-block rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning">
          Auth en modo desarrollo (bypass). Configura Clerk cuando quieras ir a
          producción.
        </p>
      )}

      {dashboard ? <HomeDashboard data={dashboard} /> : null}

      <div>
        <h2 className="mb-3 font-display text-lg tracking-tight">Módulos</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {navModules.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className="group flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-4 transition-colors hover:border-accent/40 hover:bg-surface-elevated"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="block font-medium">{item.title}</span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
