"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPunchListItem,
  updatePunchListItem,
} from "@/features/punch-list/actions/punch-list-actions";
import type { PunchListMember } from "@/features/punch-list/queries/list-punch-list";
import type { PunchListPriority } from "@prisma/client";
import { DateInput } from "@/components/ui/date-input";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type PunchListFormProps = {
  projectId: string;
  assignees: PunchListMember[];
  mode?: "create" | "edit";
  itemId?: string;
  initial?: {
    title: string;
    description: string;
    location: string;
    priority: PunchListPriority;
    assigneeId: string;
    dueDate: string;
  };
  onDone?: () => void;
};

export function PunchListForm({
  projectId,
  assignees,
  mode = "create",
  itemId,
  initial,
  onDone,
}: PunchListFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);
    if (itemId) formData.set("itemId", itemId);

    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updatePunchListItem(formData)
          : await createPunchListItem(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
      if (mode === "create") {
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Título</span>
        <input
          name="title"
          className={fieldClass}
          required
          defaultValue={initial?.title}
          placeholder="Ej. Fisura en muro — eje B"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Ubicación</span>
        <input
          name="location"
          className={fieldClass}
          defaultValue={initial?.location}
          placeholder="Piso, zona, eje…"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Descripción</span>
        <textarea
          name="description"
          rows={3}
          className={fieldClass}
          defaultValue={initial?.description}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Prioridad</span>
          <select
            name="priority"
            className={fieldClass}
            defaultValue={initial?.priority ?? "MEDIUM"}
          >
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="CRITICAL">Crítica</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Responsable</span>
          <select
            name="assigneeId"
            className={fieldClass}
            defaultValue={initial?.assigneeId ?? ""}
          >
            <option value="">Sin asignar</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Vence</span>
          <DateInput
            name="dueDate"
            className="w-full bg-surface"
            defaultValue={initial?.dueDate}
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Fotos</span>
        <input
          type="file"
          name="photos"
          accept="image/*,application/pdf"
          multiple
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground"
        />
      </label>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending
          ? "Guardando…"
          : mode === "edit"
            ? "Guardar"
            : "Crear observación"}
      </button>
    </form>
  );
}
