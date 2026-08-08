"use client";

import { useEffect, useMemo, useState } from "react";
import { Diamond, Plus } from "lucide-react";
import type {
  ProjectSchedule,
  ScheduleMilestone,
  ScheduleTask,
} from "@/features/schedule/queries/get-project-schedule";
import {
  barStyle,
  buildGanttRange,
  markerLeft,
  startOfDay,
} from "@/features/schedule/lib/gantt-range";
import {
  TASK_BAR_CLASS,
  TASK_STATUS_LABEL,
  TASK_STATUS_STYLE,
} from "@/features/schedule/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import { TaskForm } from "@/features/schedule/components/task-form";
import { MilestoneForm } from "@/features/schedule/components/milestone-form";

type ScheduleBoardProps = {
  schedule: ProjectSchedule;
  canManage: boolean;
};

type Row =
  | { kind: "milestone"; milestone: ScheduleMilestone }
  | { kind: "task"; task: ScheduleTask; indented: boolean };

const LABEL_W_DESKTOP = 220;
const LABEL_W_MOBILE = 118;
const DAY_PX_DESKTOP = 28;
const DAY_PX_MOBILE = 40;
const WEEK_PX = 56;
const ROW_H = 44;

function useIsNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);
  return narrow;
}

export function ScheduleBoard({ schedule, canManage }: ScheduleBoardProps) {
  const isNarrow = useIsNarrow();
  const labelW = isNarrow ? LABEL_W_MOBILE : LABEL_W_DESKTOP;
  const dayPx = isNarrow ? DAY_PX_MOBILE : DAY_PX_DESKTOP;

  const [taskModal, setTaskModal] = useState<ScheduleTask | null | "new">(null);
  const [milestoneModal, setMilestoneModal] = useState<
    ScheduleMilestone | null | "new"
  >(null);

  const range = useMemo(() => {
    const dates: (Date | null | undefined)[] = [
      schedule.projectStart,
      schedule.projectEnd,
      ...schedule.tasks.flatMap((t) => [t.plannedStart, t.plannedEnd]),
      ...schedule.milestones.map((m) => m.dueDate),
    ];
    return buildGanttRange(dates);
  }, [schedule]);

  const chartWidth =
    range.scale === "day"
      ? range.totalDays * dayPx
      : range.columns.length * WEEK_PX;

  const todayLeft = markerLeft(range, startOfDay(new Date()));

  const rows = useMemo(() => {
    const result: Row[] = [];
    const used = new Set<string>();

    for (const milestone of schedule.milestones) {
      result.push({ kind: "milestone", milestone });
      const children = schedule.tasks.filter(
        (t) => t.milestoneId === milestone.id,
      );
      for (const task of children) {
        used.add(task.id);
        result.push({ kind: "task", task, indented: true });
      }
    }

    for (const task of schedule.tasks.filter((t) => !used.has(t.id))) {
      result.push({ kind: "task", task, indented: false });
    }
    return result;
  }, [schedule]);

  const completed = schedule.tasks.filter((t) => t.status === "COMPLETED").length;
  const avgProgress =
    schedule.tasks.length === 0
      ? 0
      : Math.round(
          schedule.tasks.reduce((a, t) => a + t.progressPct, 0) /
            schedule.tasks.length,
        );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">Cronograma</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagrama de Gantt con tareas e hitos de la obra.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMilestoneModal("new")}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
            >
              <Diamond className="size-3.5" aria-hidden />
              Nuevo hito
            </button>
            <button
              type="button"
              onClick={() => setTaskModal("new")}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
            >
              <Plus className="size-4" aria-hidden />
              Nueva tarea
            </button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="border-l-2 border-border pl-2.5 sm:pl-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
            Tareas
          </dt>
          <dd className="mt-1 font-display text-lg sm:text-xl">
            {schedule.tasks.length}
            <span className="ml-1 text-xs font-sans text-muted-foreground sm:ml-2 sm:text-sm">
              ({completed} ok)
            </span>
          </dd>
        </div>
        <div className="border-l-2 border-border pl-2.5 sm:pl-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
            Hitos
          </dt>
          <dd className="mt-1 font-display text-lg sm:text-xl">
            {schedule.milestones.length}
          </dd>
        </div>
        <div className="border-l-2 border-accent pl-2.5 sm:pl-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
            Avance
          </dt>
          <dd className="mt-1 font-display text-lg sm:text-xl">
            {avgProgress}%
          </dd>
        </div>
      </dl>

      {schedule.tasks.length === 0 && schedule.milestones.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay tareas ni hitos. Creá la primera para armar el Gantt.
        </p>
      ) : (
        <>
          {/* Lista legible en móvil (el Gantt se scrollea horizontal) */}
          {isNarrow && (
            <ul className="space-y-2 sm:hidden">
              {rows.map((row) => {
                if (row.kind === "milestone") {
                  return (
                    <li key={`list-m-${row.milestone.id}`}>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() =>
                          canManage && setMilestoneModal(row.milestone)
                        }
                        className="flex w-full items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2.5 text-left disabled:cursor-default"
                      >
                        <Diamond
                          className={`size-3.5 shrink-0 ${row.milestone.completedAt ? "text-success" : "text-accent"}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {row.milestone.name}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {row.milestone.dueDate
                            ? formatDateAR(row.milestone.dueDate)
                            : "—"}
                        </span>
                      </button>
                    </li>
                  );
                }
                const task = row.task;
                return (
                  <li key={`list-t-${task.id}`}>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => canManage && setTaskModal(task)}
                      className="flex w-full flex-col gap-1 rounded-md border border-border bg-surface-elevated px-3 py-2.5 text-left disabled:cursor-default"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {task.name}
                        </span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${TASK_STATUS_STYLE[task.status]}`}
                        >
                          {TASK_STATUS_LABEL[task.status]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">
                          {formatDateAR(task.plannedStart)} →{" "}
                          {formatDateAR(task.plannedEnd)}
                        </span>
                        <span className="tabular-nums font-medium text-foreground">
                          {task.progressPct}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${TASK_BAR_CLASS[task.status]}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, task.progressPct))}%`,
                          }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="overflow-hidden rounded-md border border-border bg-surface-elevated">
            {isNarrow && (
              <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                Deslizá horizontalmente para ver el Gantt →
              </p>
            )}
            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <div style={{ width: labelW + chartWidth, minWidth: "100%" }}>
                {/* Header */}
                <div
                  className="sticky top-0 z-20 flex border-b border-border bg-surface-elevated"
                  style={{ height: 52 }}
                >
                  <div
                    className="sticky left-0 z-30 flex shrink-0 items-end border-r border-border bg-surface-elevated px-2 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:px-3 sm:text-xs"
                    style={{ width: labelW }}
                  >
                    Tarea / Hito
                  </div>
                  <div className="relative flex" style={{ width: chartWidth }}>
                    {range.columns.map((col, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center justify-end border-r border-border/60 px-0.5 pb-1 text-center"
                        style={{
                          width:
                            range.scale === "day"
                              ? dayPx * col.days
                              : WEEK_PX,
                        }}
                      >
                        <span className="text-[10px] leading-none text-muted-foreground">
                          {col.sublabel}
                        </span>
                        <span className="mt-0.5 text-xs font-medium tabular-nums">
                          {col.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div className="relative">
                  {todayLeft && (
                    <div
                      className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-danger"
                      style={{
                        left:
                          labelW +
                          (parseFloat(todayLeft) / 100) * chartWidth,
                      }}
                      title="Hoy"
                    />
                  )}

                  {rows.map((row) => {
                    if (row.kind === "milestone") {
                      const left = markerLeft(range, row.milestone.dueDate);
                      return (
                        <div
                          key={`m-${row.milestone.id}`}
                          className="group flex border-b border-border/70"
                          style={{ height: ROW_H }}
                        >
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() =>
                              canManage && setMilestoneModal(row.milestone)
                            }
                            className="sticky left-0 z-[5] flex shrink-0 items-center gap-1.5 border-r border-border bg-surface-elevated px-2 text-left hover:bg-muted disabled:cursor-default sm:gap-2 sm:px-3"
                            style={{ width: labelW }}
                          >
                            <Diamond
                              className={`size-3.5 shrink-0 ${row.milestone.completedAt ? "text-success" : "text-accent"}`}
                              aria-hidden
                            />
                            <span className="truncate text-xs font-medium sm:text-sm">
                              {row.milestone.name}
                            </span>
                          </button>
                          <div
                            className="relative bg-surface"
                            style={{ width: chartWidth, height: ROW_H }}
                          >
                            {left && (
                              <div
                                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                                style={{ left }}
                                title={
                                  row.milestone.dueDate
                                    ? formatDateAR(row.milestone.dueDate)
                                    : undefined
                                }
                              >
                                <div
                                  className={`size-3 rotate-45 border-2 ${
                                    row.milestone.completedAt
                                      ? "border-success bg-success"
                                      : "border-accent bg-accent"
                                  }`}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const task = row.task;
                    const style = barStyle(
                      range,
                      task.plannedStart,
                      task.plannedEnd,
                    );

                    return (
                      <div
                        key={`t-${task.id}`}
                        className="group flex border-b border-border/60"
                        style={{ height: ROW_H }}
                      >
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => canManage && setTaskModal(task)}
                          className="sticky left-0 z-[5] flex shrink-0 flex-col justify-center border-r border-border bg-surface-elevated px-2 text-left hover:bg-muted disabled:cursor-default sm:px-3"
                          style={{
                            width: labelW,
                            paddingLeft: row.indented
                              ? isNarrow
                                ? 18
                                : 28
                              : undefined,
                          }}
                        >
                          <span className="truncate text-xs font-medium sm:text-sm">
                            {task.name}
                          </span>
                          {!isNarrow && (
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span
                                className={`rounded px-1 py-px ${TASK_STATUS_STYLE[task.status]}`}
                              >
                                {TASK_STATUS_LABEL[task.status]}
                              </span>
                              <span className="tabular-nums">
                                {task.progressPct}%
                              </span>
                            </span>
                          )}
                        </button>
                        <div
                          className="relative bg-surface"
                          style={{ width: chartWidth, height: ROW_H }}
                        >
                          <div className="pointer-events-none absolute inset-0 flex">
                            {range.columns.map((col, i) => (
                              <div
                                key={i}
                                className="border-r border-border/40"
                                style={{
                                  width:
                                    range.scale === "day"
                                      ? dayPx * col.days
                                      : WEEK_PX,
                                }}
                              />
                            ))}
                          </div>

                          {style ? (
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => canManage && setTaskModal(task)}
                              className="absolute top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-sm bg-muted shadow-sm disabled:cursor-default"
                              style={style}
                              title={`${task.name}: ${formatDateAR(task.plannedStart)} → ${formatDateAR(task.plannedEnd)}`}
                            >
                              <span
                                className={`absolute inset-y-0 left-0 ${TASK_BAR_CLASS[task.status]}`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, task.progressPct))}%`,
                                }}
                              />
                              <span className="relative z-[1] block truncate px-1.5 text-[10px] font-medium leading-7 text-foreground">
                                {task.progressPct > 0
                                  ? `${task.progressPct}%`
                                  : ""}
                              </span>
                            </button>
                          ) : (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                              Sin fechas
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              Escala: {range.scale === "day" ? "días" : "semanas"} · Línea roja
              = hoy
              {canManage ? " · Tocá una fila para editar" : ""}
            </p>
          </div>
        </>
      )}

      {taskModal !== null && (
        <TaskForm
          projectId={schedule.projectId}
          milestones={schedule.milestones}
          tasks={schedule.tasks}
          initial={taskModal === "new" ? null : taskModal}
          onClose={() => setTaskModal(null)}
        />
      )}
      {milestoneModal !== null && (
        <MilestoneForm
          projectId={schedule.projectId}
          initial={milestoneModal === "new" ? null : milestoneModal}
          onClose={() => setMilestoneModal(null)}
        />
      )}
    </div>
  );
}
