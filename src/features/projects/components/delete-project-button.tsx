"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  deleteProject,
  type ProjectDeleteBlocker,
} from "@/features/projects/actions/delete-project";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
  blockers: ProjectDeleteBlocker[];
};

export function DeleteProjectButton({
  projectId,
  projectName,
  blockers,
}: DeleteProjectButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canDelete = blockers.length === 0;

  function onClick() {
    if (!canDelete) {
      const detail = blockers
        .map((b) => `${b.count} ${b.label}`)
        .join(", ");
      window.alert(
        `No se puede eliminar «${projectName}»: tiene datos cargados (${detail}).`,
      );
      return;
    }

    if (
      !window.confirm(
        `¿Eliminar la obra «${projectName}»?\n\nSolo se puede porque no tiene datos operativos. Esta acción la quita del listado.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteProject(projectId);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        title={
          canDelete
            ? "Eliminar obra vacía"
            : "No se puede eliminar: la obra tiene datos"
        }
        className={
          canDelete
            ? "inline-flex items-center gap-2 rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-70 hover:bg-surface disabled:opacity-60"
        }
      >
        <Trash2 className="size-4" aria-hidden />
        {pending ? "Eliminando…" : "Eliminar obra"}
      </button>
      {!canDelete && (
        <p className="max-w-md text-xs text-muted-foreground">
          Solo se puede eliminar si no hay datos cargados. Ahora tiene:{" "}
          {blockers.map((b) => `${b.count} ${b.label}`).join(", ")}.
        </p>
      )}
    </div>
  );
}
