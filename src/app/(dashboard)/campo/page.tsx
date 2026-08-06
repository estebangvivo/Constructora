import Link from "next/link";
import { ClipboardList, TriangleAlert, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { listProjects } from "@/features/projects/queries/get-projects";
import { projectHref } from "@/config/navigation";
import { getOrganizationSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Hub móvil de campo: elegir obra y entrar directo a parte diario / punch list.
 */
export default async function CampoPage() {
  const session = await getOrganizationSession();
  if (!session) redirect("/onboarding/planes");

  const projects = await listProjects("open");

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24">
      <header className="mb-6">
        <h1 className="font-display text-3xl tracking-tight">Datos en Obra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elegí la obra y cargá el parte diario o la punch list.
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
          No hay obras abiertas. Creá una obra para usar el modo campo.
        </p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {project.code}
                </p>
                <p className="font-display text-lg tracking-tight">
                  {project.name}
                </p>
                {(project.city || project.clientName) && (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[project.city, project.clientName].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <Link
                  href={projectHref(project.id, "/daily-report/new")}
                  className="flex min-h-16 items-center gap-3 px-4 py-4 text-left transition-colors active:bg-muted/60 hover:bg-muted/40"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <ClipboardList className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">Parte diario</span>
                    <span className="block text-xs text-muted-foreground">
                      Cargar el día
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
                <Link
                  href={projectHref(project.id, "/punch-list")}
                  className="flex min-h-16 items-center gap-3 px-4 py-4 text-left transition-colors active:bg-muted/60 hover:bg-muted/40"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <TriangleAlert className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">Punch list</span>
                    <span className="block text-xs text-muted-foreground">
                      Observaciones y fotos
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
