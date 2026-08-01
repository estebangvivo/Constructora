"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "@/features/schedule/actions/schedule-actions";
import type { ScheduleMilestone } from "@/features/schedule/queries/get-project-schedule";
import { DateInput } from "@/components/ui/date-input";
import { toDateInputValue } from "@/lib/format-date";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type MilestoneFormProps = {
  projectId: string;
  initial?: ScheduleMilestone | null;
  onClose: () => void;
};

export function MilestoneForm({
  projectId,
  initial,
  onClose,
}: MilestoneFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(initial?.dueDate));
  const [completed, setCompleted] = useState(Boolean(initial?.completedAt));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = initial
        ? await updateMilestone({
            milestoneId: initial.id,
            name,
            description: description || undefined,
            dueDate: dueDate || undefined,
            completed,
          })
        : await createMilestone({
            projectId,
            name,
            description: description || undefined,
            dueDate: dueDate || undefined,
          });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function onDelete() {
    if (!initial) return;
    if (!window.confirm("¿Eliminar este hito? Las tareas quedarán sin hito.")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteMilestone(initial.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-lg"
      >
        <h3 className="font-display text-lg tracking-tight">
          {initial ? "Editar hito" : "Nuevo hito"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El hito aparece como rombo en el Gantt.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Nombre</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Descripción</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Fecha</span>
            <DateInput
              value={dueDate}
              onChange={setDueDate}
              className="w-full bg-surface"
            />
          </label>
          {initial && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
              />
              Completado
            </label>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          {initial ? (
            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
