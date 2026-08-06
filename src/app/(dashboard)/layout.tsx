import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OrganizationTheme } from "@/features/settings/components/organization-theme";
import { ChecksDueAlertBanner } from "@/features/treasury/components/checks-due-alert-banner";
import { TrialAlertBanner } from "@/features/billing/components/trial-alert-banner";
import { FieldBottomNav } from "@/components/layout/field-bottom-nav";
import { PresenceHeartbeat } from "@/features/auth/components/presence-heartbeat";
import { SessionIdleGuard } from "@/features/auth/components/session-idle-guard";
import { organizationLogoSrc } from "@/features/settings/lib/organization-logo";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME_ID, themeToCssText } from "@/config/themes";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import { markOrganizationPastDueIfNeeded } from "@/features/billing/lib/activate";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";

export const dynamic = "force-dynamic";

async function currentPathname(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-pathname") ||
    h.get("next-url") ||
    h.get("x-invoke-path") ||
    ""
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession().catch(() => null);
  if (!session) {
    redirect("/sign-in");
  }

  const superadmin = isPlatformSuperadmin(session);

  // Superadmin sin empresa: solo panel de plataforma.
  if (!session.organizationId) {
    if (!superadmin) {
      redirect("/onboarding/planes");
    }

    const pathname = await currentPathname();
    const allowedWithoutOrg =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/solicitudes") ||
      pathname === "/admin" ||
      pathname === "" ||
      pathname === "/";

    if (
      pathname &&
      !allowedWithoutOrg
    ) {
      redirect("/admin");
    }

    return (
      <>
        <style
          dangerouslySetInnerHTML={{
            __html: `html{${themeToCssText(DEFAULT_THEME_ID)}}`,
          }}
        />
        <OrganizationTheme themeId={DEFAULT_THEME_ID} />
        <SessionIdleGuard idleMinutes={30} />
        <DashboardShell
          role={session.role}
          modules={session.allowedModules}
          organizationName="Plataforma"
          logoUrl={null}
          userEmail={session.user.email}
          isPlatformSuperadmin={superadmin}
        >
          {children}
        </DashboardShell>
      </>
    );
  }

  await markOrganizationPastDueIfNeeded(session.organizationId);

  let organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      name: true,
      logoUrl: true,
      themeId: true,
      billingStatus: true,
      paidUntil: true,
    },
  });

  if (!organization) {
    if (superadmin) redirect("/admin");
    redirect("/onboarding/planes");
  }

  if (!superadmin && !organizationHasAppAccess(organization)) {
    redirect("/billing");
  }

  if (
    organization.logoUrl?.startsWith("/uploads/") &&
    process.env.NODE_ENV === "production"
  ) {
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { logoUrl: null },
    });
    organization = { ...organization, logoUrl: null };
  }

  let idleMinutes = 30;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ sessionIdleMinutes: number | null }>
    >`
      SELECT "sessionIdleMinutes" FROM organizations WHERE id = ${session.organizationId} LIMIT 1
    `;
    idleMinutes = Math.min(480, Math.max(5, rows[0]?.sessionIdleMinutes ?? 30));
  } catch (error) {
    console.warn("layout sessionIdleMinutes", error);
  }

  const themeId = organization.themeId ?? DEFAULT_THEME_ID;
  const logoUrl = organizationLogoSrc(organization.logoUrl);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `html{${themeToCssText(themeId)}}`,
        }}
      />
      <OrganizationTheme themeId={themeId} />
      <PresenceHeartbeat />
      <SessionIdleGuard idleMinutes={idleMinutes} />
      <DashboardShell
        role={session.role}
        modules={session.allowedModules}
        organizationName={organization.name}
        logoUrl={logoUrl}
        userEmail={session.user.email}
        isPlatformSuperadmin={superadmin}
      >
        <TrialAlertBanner />
        <ChecksDueAlertBanner />
        {children}
        <FieldBottomNav />
      </DashboardShell>
    </>
  );
}
