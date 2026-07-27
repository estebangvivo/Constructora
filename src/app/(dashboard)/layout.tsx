import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OrganizationTheme } from "@/features/settings/components/organization-theme";
import { ChecksDueAlertBanner } from "@/features/treasury/components/checks-due-alert-banner";
import { organizationLogoSrc } from "@/features/settings/lib/organization-logo";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME_ID, themeToCssText } from "@/config/themes";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession().catch(() => null);
  if (!session) {
    redirect("/sign-in");
  }

  let organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, logoUrl: true, themeId: true },
  });

  // Logos viejos en /uploads/ no existen en Railway: limpiar para no mostrar ícono roto
  if (
    organization?.logoUrl?.startsWith("/uploads/") &&
    process.env.NODE_ENV === "production"
  ) {
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { logoUrl: null },
    });
    organization = { ...organization, logoUrl: null };
  }

  const themeId = organization?.themeId ?? DEFAULT_THEME_ID;
  const logoUrl = organizationLogoSrc(organization?.logoUrl);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `html{${themeToCssText(themeId)}}`,
        }}
      />
      <OrganizationTheme themeId={themeId} />
      <DashboardShell
        role={session.role}
        modules={session.allowedModules}
        organizationName={organization?.name}
        logoUrl={logoUrl}
      >
        <ChecksDueAlertBanner />
        {children}
      </DashboardShell>
    </>
  );
}
