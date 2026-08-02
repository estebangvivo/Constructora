import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEffectivePlanPrices } from "@/features/billing/lib/effective-plans";
import { prisma } from "@/lib/prisma";
import { organizationHasAppAccess } from "@/features/billing/lib/access";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { MercadoPagoReturnSync } from "@/features/billing/components/mercadopago-return-sync";
import { PlansSignupView } from "@/features/billing/components/plans-signup-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    mp?: string;
    payment_id?: string;
    collection_id?: string;
    external_reference?: string;
    status?: string;
    preference_id?: string;
  }>;
};

export default async function OnboardingPlanesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const sp = (await searchParams) ?? {};
  const mpReturn =
    sp.mp === "success" || Boolean(sp.payment_id || sp.collection_id);

  if (session.organizationId && !mpReturn) {
    if (isPlatformSuperadmin(session)) {
      redirect("/");
    }
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { billingStatus: true, paidUntil: true },
    });
    if (org && organizationHasAppAccess(org)) {
      redirect("/");
    }
    redirect("/billing");
  }

  const prices = await getEffectivePlanPrices();

  return (
    <div className="space-y-8">
      {mpReturn && (
        <MercadoPagoReturnSync
          paymentId={sp.payment_id}
          collectionId={sp.collection_id}
          externalReference={sp.external_reference}
          status={sp.status}
          preferenceId={sp.preference_id}
          successHref="/"
        />
      )}
      <PlansSignupView prices={prices} />
    </div>
  );
}
