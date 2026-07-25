import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TurneroBrandProvider } from "@/features/turnero/components/turnero-brand";
import { TurneroBackToApp } from "@/features/turnero/components/turnero-back-to-app";

export const dynamic = "force-dynamic";

/**
 * Layout kiosk autenticado (tótem, operador, hub).
 * La pantalla pública vive en (turnero-public).
 */
export default async function TurneroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession().catch(() => null);
  if (!session) {
    redirect("/sign-in?next=/turnero");
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, logoUrl: true },
  });

  return (
    <TurneroBrandProvider
      brand={{
        name: org?.name ?? "Turnero",
        logoUrl: org?.logoUrl ?? null,
      }}
    >
      <div className="flex min-h-dvh min-h-screen flex-col bg-[#0a0a0a] text-[#f5f5f5]">
        <TurneroBackToApp />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </TurneroBrandProvider>
  );
}
