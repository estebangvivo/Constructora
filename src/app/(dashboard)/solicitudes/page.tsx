import { redirect } from "next/navigation";
import { getSession, hasOrganization } from "@/lib/auth";
import { hasModule } from "@/features/auth/lib/modules";
import { listMyFeatureRequests } from "@/features/feature-requests/actions/feature-request-actions";
import { CreateFeatureRequestButton } from "@/features/feature-requests/components/create-feature-request-button";
import { FeatureRequestList } from "@/features/feature-requests/components/feature-request-list";

export const dynamic = "force-dynamic";

export default async function SolicitudesPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!hasOrganization(session)) redirect("/onboarding/planes");
  if (!hasModule(session.allowedModules, "featureRequests")) redirect("/");

  const items = await listMyFeatureRequests();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-tight">
            Solicitudes de mejora
          </h1>
          <p className="mt-1 max-w-xl text-muted-foreground">
            Pedí cambios o mejoras al sistema. El equipo de la plataforma te
            responderá, cotizará o te hará consultas desde acá.
          </p>
        </div>
        {items.length > 0 && <CreateFeatureRequestButton />}
      </header>

      <FeatureRequestList items={items} showEmptyCreate />
    </div>
  );
}
