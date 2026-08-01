import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  setLocalSessionCookie,
  signLocalSession,
} from "@/features/auth/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // Si ya tiene membresía pero la cookie quedó sin org (post-pago), enlazar
  if (!session.organizationId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    if (membership) {
      const token = await signLocalSession({
        userId: session.user.id,
        organizationId: membership.organizationId,
      });
      await setLocalSessionCookie(token);
      redirect("/");
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border px-4 py-4">
        <p className="text-sm text-muted-foreground">
          Sesión: <span className="text-foreground">{session.user.email}</span>
        </p>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
