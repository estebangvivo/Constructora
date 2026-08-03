import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutLocal } from "@/features/auth/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { AppBrandLogo } from "@/components/brand/app-brand-logo";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // Superadmin sin empresa: panel de plataforma, no onboarding de planes.
  if (isPlatformSuperadmin(session) && !session.organizationId) {
    redirect("/admin");
  }

  // Si ya tiene membresía pero la cookie quedó sin org, restaurar vía route handler
  // (los layouts no pueden modificar cookies).
  if (!session.organizationId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (membership) {
      redirect("/api/auth/restore-org");
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AppBrandLogo size="header" />
            <p className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
              Sesión:{" "}
              <span className="text-foreground">{session.user.email}</span>
            </p>
          </div>
          <form action={logoutLocal}>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
