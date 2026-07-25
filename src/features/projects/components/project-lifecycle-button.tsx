"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import {
  completeProject,
  reopenProject,
} from "@/features/projects/actions/project-lifecycle";
import type { ProjectStatus } from "@prisma/client";

const CLOSED: ProjectStatus[] = ["COMPLETED", "CANCELLED"];

type ProjectLifecycleButtonProps = {
  projectId: string;
  status: ProjectStatus;
  /** compact = texto corto para filas del listado */
  variant?: "default" | "compact";
};

export function ProjectLifecycleButton({
  projectId,
  status,
  variant = "default",
}: ProjectLifecycleButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isClosed = CLOSED.includes(status);
  const compact = variant === "compact";

  function run() {
    setError(null);
    if (!isClosed) {
      if (
        !window.confirm(
          "¿Marcar fin de obra? Dejará de aparecer en el listado de pendientes.",
        )
      ) {
        return;
      }
    }

    startTransition(async () => {
      const result = isClosed
        ? await reopenProject(projectId)
        : await completeProject(projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!isClosed) {
        router.push("/projects?vista=terminadas");
        router.refresh();
        return;
      }
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <div className={compact ? "shrink-0" : "space-y-1"}>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          run();
        }}
        className={
          compact
            ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
            : "inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        }
      >
        {isClosed ? (
          <RotateCcw className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        )}
        <span>{isClosed ? "Reabrir obra" : "Fin de obra"}</span>
      </button>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
