"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@prisma/client";
import {
  createTask,
  updateTask,
  deleteTask,
} from "@/features/schedule/actions/schedule-actions";
import type {
  ScheduleMilestone,
  ScheduleTask,
} from "@/features/schedule/queries/get-project-schedule";
import { TASK_STATUS_LABEL } from "@/features/schedule/lib/labels";
import { DateInput } from "@/components/ui/date-input";
import { toDateInputValue } from "@/lib/format-date";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

const STATUSES = Object.keys(TASK_STATUS_LABEL) as TaskStatus[];

type TaskFormProps = {
  projectId: string;
  milestones: ScheduleMilestone[];
  tasks: ScheduleTask[];
  initial?: ScheduleTask | null;
  onClose: () => void;
};

export function TaskForm({
  projectId,
  milestones,
  tasks,
  initial,
  onClose,
}: TaskFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(
    initial?.status ?? "NOT_STARTED",
  );
  const [progressPct, setProgressPct] = useState(initial?.progressPct ?? 0);
  const [plannedStart, setPlannedStart] = useState(
    toDateInputValue(initial?.plannedStart),
  );
  const [plannedEnd, setPlannedEnd] = useState(
    toDateInputValue(initial?.plannedEnd),
  );
  const [milestoneId, setMilestoneId] = useState(initial?.milestoneId ?? "");
  const [predecessorId, setPredecessorId] = useState(
    initial?.predecessorId ?? "",
  );

  const predecessors = tasks.filter((t) => t.id !== initial?.id);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        name,
        description: description || undefined,
        status,
        progressPct,
        plannedStart: plannedStart || undefined,
        plannedEnd: plannedEnd || undefined,
        milestoneId: milestoneId || null,
        predecessorId: predecessorId || null,
      };
      const result = initial
        ? await updateTask({ taskId: initial.id, ...payload })
        : await createTask({ projectId, ...payload });
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
    if (!window.confirm("¿Eliminar esta tarea?")) return;
    startTransition(async () => {
      const result = await deleteTask(initial.id);
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-lg"
      >
        <h3 className="font-display text-lg tracking-tight">
          {initial ? "Editar tarea" : "Nueva tarea"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Fechas planificadas alimentan la barra del Gantt.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Nombre</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Descripción</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Inicio</span>
            <DateInput
              value={plannedStart}
              onChange={setPlannedStart}
              className="w-full bg-surface"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Fin</span>
            <DateInput
              value={plannedEnd}
              onChange={setPlannedEnd}
              className="w-full bg-surface"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Estado</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className={fieldClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Avance %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="1"
              value={progressPct}
              onChange={(e) => setProgressPct(Number(e.target.value))}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Hito</span>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Sin hito</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Predecesor (FS)
            </span>
            <select
              value={predecessorId}
              onChange={(e) => setPredecessorId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Ninguno</option>
              {predecessors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
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
