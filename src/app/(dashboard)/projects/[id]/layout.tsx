import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectNav } from "@/components/layout/project-nav";
import { getProjectById } from "@/features/projects/queries/get-projects";
import { PROJECT_STATUS_LABEL } from "@/features/projects/lib/status";
import { getProjectRole, getSession } from "@/lib/auth";
import type { AppRole } from "@/types";

type ProjectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  const projectRole = await getProjectRole(
    project.id,
    session.user.id,
    session.organizationRole,
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface px-4 py-4 lg:px-6">
        <Link
          href="/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Obras
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {project.code}
            </p>
            <h1 className="font-display text-2xl tracking-tight md:text-3xl">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[project.city, project.clientName]
                .filter(Boolean)
                .join(" · ") || "Sin ciudad"}{" "}
              · {PROJECT_STATUS_LABEL[project.status]}
            </p>
          </div>
        </div>
      </header>

      <ProjectNav
        projectId={id}
        role={projectRole as AppRole}
        modules={session.allowedModules}
      />

      <div className="flex-1 px-4 py-6 lg:px-6">{children}</div>
    </div>
  );
}
