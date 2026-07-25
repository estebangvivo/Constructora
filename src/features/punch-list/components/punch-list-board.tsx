"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Plus } from "lucide-react";
import type { PunchListStatus } from "@prisma/client";
import {
  deletePunchListItem,
  setPunchListStatus,
} from "@/features/punch-list/actions/punch-list-actions";
import type {
  PunchListMember,
  PunchListRow,
} from "@/features/punch-list/queries/list-punch-list";
import { PunchListForm } from "@/features/punch-list/components/punch-list-form";
import {
  PL_PRIORITY_LABEL,
  PL_PRIORITY_STYLE,
  PL_STATUS_LABEL,
  PL_STATUS_STYLE,
} from "@/features/punch-list/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import { cn } from "@/lib/utils";

function asDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

type PunchListBoardProps = {
  projectId: string;
  items: PunchListRow[];
  assignees: PunchListMember[];
  canManage: boolean;
  initialFilter?: PunchListStatus | "ALL";
};

const FILTERS: { key: PunchListStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Todas" },
  { key: "PENDING", label: "Pendiente" },
  { key: "IN_PROGRESS", label: "En proceso" },
  { key: "RESOLVED", label: "Resuelto" },
];

export function PunchListBoard({
  projectId,
  items,
  assignees,
  canManage,
  initialFilter = "ALL",
}: PunchListBoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<PunchListStatus | "ALL">(initialFilter);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const visible =
    filter === "ALL" ? items : items.filter((i) => i.status === filter);
  const openCount = items.filter((i) => i.status !== "RESOLVED").length;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        window.alert(result.error ?? "No se pudo completar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">Punch List</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {openCount} observación{openCount === 1 ? "" : "es"} abierta
            {openCount === 1 ? "" : "s"}. Registro con foto, estado y
            responsable.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Nueva observación
          </button>
        )}
      </div>

      {showForm && canManage && (
        <div className="rounded-md border border-border bg-surface p-4">
          <h3 className="mb-3 font-medium">Nueva observación</h3>
          <PunchListForm
            projectId={projectId}
            assignees={assignees}
            onDone={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              filter === f.key
                ? "border-accent bg-accent/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-surface",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No hay observaciones
          {filter !== "ALL" ? ` en estado «${PL_STATUS_LABEL[filter]}»` : ""}.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${PL_STATUS_STYLE[item.status]}`}
                    >
                      {PL_STATUS_LABEL[item.status]}
                    </span>
                    <span
                      className={`text-xs font-medium ${PL_PRIORITY_STYLE[item.priority]}`}
                    >
                      {PL_PRIORITY_LABEL[item.priority]}
                    </span>
                    {item.photoUrls.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Camera className="size-3.5" aria-hidden />
                        {item.photoUrls.length}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.location || "Sin ubicación"}
                    {item.assigneeName ? ` · ${item.assigneeName}` : ""}
                    {item.dueDate
                      ? ` · Vence ${formatDateAR(item.dueDate)}`
                      : ""}
                  </p>
                  {item.description && (
                    <p className="mt-2 text-sm whitespace-pre-wrap">
                      {item.description}
                    </p>
                  )}
                  {item.photoUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.photoUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded border border-border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="size-16 object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.status === "PENDING" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            setPunchListStatus({
                              itemId: item.id,
                              status: "IN_PROGRESS",
                            }),
                          )
                        }
                        className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-background disabled:opacity-60"
                      >
                        En proceso
                      </button>
                    )}
                    {item.status !== "RESOLVED" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            setPunchListStatus({
                              itemId: item.id,
                              status: "RESOLVED",
                            }),
                          )
                        }
                        className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-background disabled:opacity-60"
                      >
                        Resolver
                      </button>
                    )}
                    {item.status === "RESOLVED" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            setPunchListStatus({
                              itemId: item.id,
                              status: "PENDING",
                            }),
                          )
                        }
                        className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-background disabled:opacity-60"
                      >
                        Reabrir
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setEditingId((id) =>
                          id === item.id ? null : item.id,
                        )
                      }
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-background disabled:opacity-60"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm("¿Eliminar esta observación?"))
                          return;
                        run(() => deletePunchListItem(item.id));
                      }}
                      className="rounded-md px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              {editingId === item.id && canManage && (
                <div className="mt-4 border-t border-border pt-4">
                  <PunchListForm
                    projectId={projectId}
                    assignees={assignees}
                    mode="edit"
                    itemId={item.id}
                    initial={{
                      title: item.title,
                      description: item.description ?? "",
                      location: item.location ?? "",
                      priority: item.priority,
                      assigneeId: item.assigneeId ?? "",
                      dueDate: asDateInput(item.dueDate),
                    }}
                    onDone={() => setEditingId(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
