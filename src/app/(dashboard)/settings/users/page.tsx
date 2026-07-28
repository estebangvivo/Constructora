import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listOrganizationUsers, listTurneroPuestosForUsers } from "@/features/auth/actions/user-actions";
import { UsersAdminPanel } from "@/features/auth/components/users-admin-panel";
import { hasModule } from "@/features/auth/lib/modules";

export const dynamic = "force-dynamic";

export default async function SettingsUsersPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const canManage =
    hasModule(session.allowedModules, "users") ||
    ["ADMIN", "DIRECTOR"].includes(session.organizationRole);

  if (!canManage) redirect("/settings");

  const [users, puestos] = await Promise.all([
    listOrganizationUsers(),
    listTurneroPuestosForUsers(),
  ]);

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          ← Configuración
        </Link>
      </p>
      <UsersAdminPanel
        users={users}
        puestos={puestos}
        currentUserId={session.user.id}
        canAssignAdmin={session.organizationRole === "ADMIN"}
      />
    </div>
  );
}
