import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession, hasOrganization } from "@/lib/auth";
import { hasModule } from "@/features/auth/lib/modules";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";
import { getFeatureRequestDetail } from "@/features/feature-requests/actions/feature-request-actions";
import { FeatureRequestDetail } from "@/features/feature-requests/components/feature-request-detail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SolicitudDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const superadmin = isPlatformSuperadmin(session);
  if (!hasOrganization(session) && !superadmin) {
    redirect("/onboarding/planes");
  }

  if (
    !superadmin &&
    !hasModule(session.allowedModules, "featureRequests")
  ) {
    redirect("/");
  }

  const request = await getFeatureRequestDetail(id);
  if (!request) notFound();

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mx-auto mb-4 max-w-3xl">
        <Link
          href={
            superadmin && !request.isOwner
              ? "/admin?tab=requests"
              : "/solicitudes"
          }
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </div>
      <FeatureRequestDetail request={request} />
    </div>
  );
}
