import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listMyOrganizations } from "@/features/auth/actions/organization-actions";
import { SelectOrganizationPanel } from "@/features/auth/components/select-organization-panel";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ required?: string }>;
};

export default async function SelectOrganizationPage({
  searchParams,
}: PageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/select-organization");

  const { required } = await searchParams;
  const organizations = await listMyOrganizations();
  const superadmin = isPlatformSuperadmin(session);

  return (
    <div className="flex min-h-dvh min-h-screen items-center justify-center bg-background px-4 py-8">
      <SelectOrganizationPanel
        organizations={organizations}
        requireChoice={required === "1" && !superadmin}
        isPlatformSuperadmin={superadmin}
        hasActiveOrganization={Boolean(session.organizationId)}
      />
    </div>
  );
}
