import Link from "next/link";
import { FolderKanban } from "lucide-react";
import {
  countProjectsByScope,
  listProjects,
} from "@/features/projects/queries/get-projects";
import { CreateProjectButton } from "@/features/projects/components/create-project-button";
import { ProjectLifecycleButton } from "@/features/projects/components/project-lifecycle-button";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
} from "@/features/projects/lib/status";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listActiveClients } from "@/features/clients/queries/list-clients";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ vista?: string }>;
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const { vista } = await searchParams;
  const scope = vista === "terminadas" ? "closed" : "open";
  const canManage = ["ADMIN", "DIRECTOR", "RESIDENT"].includes(
    session.organizationRole,
  );

  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let counts = { open: 0, closed: 0 };
  let clients: Awaited<ReturnType<typeof listActiveClients>> = [];
  let loadError: string | null = null;

  try {
    [projects, counts, clients] = await Promise.all([
      listProjects(scope),
      countProjectsByScope(),
      listActiveClients(),
    ]);
  } catch {
    loadError =
      "No se pudieron cargar las obras. ¿Corriste `npm run db:setup`?";
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Obras</h1>
          <p className="mt-1 text-muted-foreground">
            {scope === "open"
              ? "Obras pendientes: presupuesto, campo y logística."
              : "Obras finalizadas o canceladas."}
          </p>
        </div>
        {scope === "open" && <CreateProjectButton clients={clients} />}
      </div>

      <div className="mb-6 flex gap-1 border-b border-border">
        <Link
          href="/projects"
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            scope === "open"
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pendientes
          <span className="ml-1.5 text-muted-foreground">({counts.open})</span>
        </Link>
        <Link
          href="/projects?vista=terminadas"
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            scope === "closed"
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Terminadas
          <span className="ml-1.5 text-muted-foreground">({counts.closed})</span>
        </Link>
      </div>

      {loadError && (
        <p
          className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {loadError}
        </p>
      )}

      {!loadError && projects.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-surface/50 px-4 py-10 text-center text-sm text-muted-foreground">
          {scope === "open" ? (
            <>
              No hay obras pendientes. Creá una nueva o ejecutá{" "}
              <code className="text-accent">npm run db:seed</code>.
            </>
          ) : (
            "Todavía no hay obras terminadas. Usá «Fin de obra» en una obra activa."
          )}
        </p>
      )}

      {projects.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <Link
                href={`/projects/${project.id}`}
                className="flex min-w-0 flex-1 items-start gap-3 transition-colors hover:opacity-90"
              >
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-accent">
                  <FolderKanban className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {project.code}
                  </p>
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[project.city, project.clientName]
                      .filter(Boolean)
                      .join(" · ") || "Sin ciudad"}
                  </p>
                </div>
              </Link>

              <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:pl-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${PROJECT_STATUS_STYLE[project.status]}`}
                >
                  {PROJECT_STATUS_LABEL[project.status]}
                </span>
                <div className="w-28">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Avance</span>
                    <span>{project.progressPct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${project.progressPct}%` }}
                    />
                  </div>
                </div>
                {canManage && (
                  <ProjectLifecycleButton
                    projectId={project.id}
                    status={project.status}
                    variant="compact"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
