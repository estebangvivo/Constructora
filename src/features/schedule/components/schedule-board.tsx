"use client";

import { useMemo, useState } from "react";
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

const LABEL_W = 260;
const DAY_PX = 28;
const WEEK_PX = 56;
const ROW_H = 44;

export function ScheduleBoard({ schedule, canManage }: ScheduleBoardProps) {
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
      ? range.totalDays * DAY_PX
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

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Tareas
          </dt>
          <dd className="mt-1 font-display text-xl">
            {schedule.tasks.length}
            <span className="ml-2 text-sm font-sans text-muted-foreground">
              ({completed} completadas)
            </span>
          </dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Hitos
          </dt>
          <dd className="mt-1 font-display text-xl">
            {schedule.milestones.length}
          </dd>
        </div>
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Avance medio
          </dt>
          <dd className="mt-1 font-display text-xl">{avgProgress}%</dd>
        </div>
      </dl>

      {schedule.tasks.length === 0 && schedule.milestones.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay tareas ni hitos. Creá la primera para armar el Gantt.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="overflow-x-auto">
            <div
              className="min-w-full"
              style={{ minWidth: LABEL_W + chartWidth }}
            >
              {/* Header */}
              <div
                className="sticky top-0 z-20 flex border-b border-border bg-surface"
                style={{ height: 52 }}
              >
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-end border-r border-border bg-surface px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  style={{ width: LABEL_W }}
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
                            ? DAY_PX * col.days
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
                    className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-danger/70"
                    style={{ left: LABEL_W + (parseFloat(todayLeft) / 100) * chartWidth }}
                    title="Hoy"
                  />
                )}

                {rows.map((row) => {
                  if (row.kind === "milestone") {
                    const left = markerLeft(range, row.milestone.dueDate);
                    return (
                      <div
                        key={`m-${row.milestone.id}`}
                        className="group flex border-b border-border/70 bg-surface/50"
                        style={{ height: ROW_H }}
                      >
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() =>
                            canManage && setMilestoneModal(row.milestone)
                          }
                          className="sticky left-0 z-[5] flex shrink-0 items-center gap-2 border-r border-border bg-surface/95 px-3 text-left hover:bg-surface disabled:cursor-default"
                          style={{ width: LABEL_W }}
                        >
                          <Diamond
                            className={`size-3.5 shrink-0 ${row.milestone.completedAt ? "text-success" : "text-accent"}`}
                            aria-hidden
                          />
                          <span className="truncate text-sm font-medium">
                            {row.milestone.name}
                          </span>
                        </button>
                        <div
                          className="relative"
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
                      className="group flex border-b border-border/60 hover:bg-surface/40"
                      style={{ height: ROW_H }}
                    >
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => canManage && setTaskModal(task)}
                        className="sticky left-0 z-[5] flex shrink-0 flex-col justify-center border-r border-border bg-background/95 px-3 text-left hover:bg-surface disabled:cursor-default"
                        style={{
                          width: LABEL_W,
                          paddingLeft: row.indented ? 28 : 12,
                        }}
                      >
                        <span className="truncate text-sm font-medium">
                          {task.name}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={`rounded px-1 py-px ${TASK_STATUS_STYLE[task.status]}`}
                          >
                            {TASK_STATUS_LABEL[task.status]}
                          </span>
                          <span className="tabular-nums">{task.progressPct}%</span>
                        </span>
                      </button>
                      <div
                        className="relative"
                        style={{ width: chartWidth, height: ROW_H }}
                      >
                        {/* grid lines */}
                        <div className="pointer-events-none absolute inset-0 flex">
                          {range.columns.map((col, i) => (
                            <div
                              key={i}
                              className="border-r border-border/40"
                              style={{
                                width:
                                  range.scale === "day"
                                    ? DAY_PX * col.days
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
                            className="absolute top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-sm bg-muted-foreground/25 disabled:cursor-default"
                            style={style}
                            title={`${task.name}: ${formatDateAR(task.plannedStart)} → ${formatDateAR(task.plannedEnd)}`}
                          >
                            <span
                              className={`absolute inset-y-0 left-0 ${TASK_BAR_CLASS[task.status]}`}
                              style={{
                                width: `${Math.min(100, Math.max(0, task.progressPct))}%`,
                              }}
                            />
                            <span className="relative z-[1] block truncate px-1.5 text-[10px] font-medium leading-6 text-foreground">
                              {task.progressPct > 0 ? `${task.progressPct}%` : ""}
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
            Escala: {range.scale === "day" ? "días" : "semanas"} · Línea roja =
            hoy
            {canManage ? " · Clic en fila o barra para editar" : ""}
          </p>
        </div>
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
