"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CloudSun,
  HardHat,
  TriangleAlert,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { PunchListPriority, WeatherCondition } from "@prisma/client";
import {
  createDailyReport,
  updateDailyReport,
  deleteDailyReport,
  type AdvanceInput,
  type EquipmentInput,
  type IncidentInput,
  type WorkforceInput,
} from "@/features/daily-report/actions/daily-report-actions";
import type { DailyReportDetail } from "@/features/daily-report/queries/list-daily-reports";
import {
  SEVERITY_LABEL,
  SEVERITY_OPTIONS,
  WEATHER_LABEL,
  WEATHER_OPTIONS,
} from "@/features/daily-report/lib/labels";
import { DateInput } from "@/components/ui/date-input";
import { toDateInputValue } from "@/lib/format-date";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

const notesClass = `${fieldClass} min-h-[72px]`;

type Props = {
  projectId: string;
  initial?: DailyReportDetail | null;
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <h3 className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function DailyReportForm({ projectId, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [reportDate, setReportDate] = useState(
    toDateInputValue(initial?.reportDate ?? new Date()),
  );
  const [weather, setWeather] = useState<WeatherCondition | "">(
    initial?.weather ?? "CLEAR",
  );
  const [temperature, setTemperature] = useState<string>(
    initial?.temperature != null ? String(initial.temperature) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [weatherNotes, setWeatherNotes] = useState(initial?.weatherNotes ?? "");
  const [workforceNotes, setWorkforceNotes] = useState(
    initial?.workforceNotes ?? "",
  );
  const [equipmentNotes, setEquipmentNotes] = useState(
    initial?.equipmentNotes ?? "",
  );
  const [advanceNotes, setAdvanceNotes] = useState(initial?.advanceNotes ?? "");
  const [incidentNotes, setIncidentNotes] = useState(
    initial?.incidentNotes ?? "",
  );

  const [workforce, setWorkforce] = useState<WorkforceInput[]>(
    initial?.workforce.map((w) => ({
      workerName: w.workerName,
      roleOrTrade: w.roleOrTrade ?? "",
      companyName: w.companyName ?? "",
      hoursWorked: w.hoursWorked,
      notes: w.notes ?? "",
    })) ?? [],
  );
  const [equipment, setEquipment] = useState<EquipmentInput[]>(
    initial?.equipment.map((e) => ({
      equipmentName: e.equipmentName,
      hoursUsed: e.hoursUsed,
      operatorName: e.operatorName ?? "",
      notes: e.notes ?? "",
    })) ?? [],
  );
  const [advances, setAdvances] = useState<AdvanceInput[]>(
    initial?.advances.map((a) => ({
      description: a.description,
      quantity: a.quantity,
      unit: a.unit ?? "",
      notes: a.notes ?? "",
    })) ?? [],
  );
  const [incidents, setIncidents] = useState<IncidentInput[]>(
    initial?.incidents.map((i) => ({
      title: i.title,
      description: i.description ?? "",
      notes: i.notes ?? "",
      severity: i.severity,
    })) ?? [],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      projectId,
      reportDate,
      weather,
      temperature: temperature === "" ? null : Number(temperature),
      notes,
      weatherNotes,
      workforceNotes,
      equipmentNotes,
      advanceNotes,
      incidentNotes,
      workforce,
      equipment,
      advances,
      incidents,
    };

    startTransition(async () => {
      const result = initial
        ? await updateDailyReport(initial.id, payload)
        : await createDailyReport(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/${projectId}/daily-report/${result.id}`);
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial) return;
    if (!window.confirm("¿Eliminar este parte diario?")) return;
    startTransition(async () => {
      const result = await deleteDailyReport(initial.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/${projectId}/daily-report`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Fecha</span>
          <DateInput
            required
            value={reportDate}
            onChange={setReportDate}
            className="w-full bg-surface"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">
            Notas generales del día
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={notesClass}
            placeholder="Observaciones generales del parte…"
          />
        </label>
      </section>

      <Section
        title="Clima"
        icon={<CloudSun className="size-4 text-accent" aria-hidden />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Condición</span>
            <select
              value={weather}
              onChange={(e) =>
                setWeather(e.target.value as WeatherCondition | "")
              }
              className={fieldClass}
            >
              <option value="">—</option>
              {WEATHER_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {WEATHER_LABEL[w]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Temperatura (°C)
            </span>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Notas de clima
            </span>
            <textarea
              value={weatherNotes}
              onChange={(e) => setWeatherNotes(e.target.value)}
              rows={2}
              className={notesClass}
              placeholder="Ej. Lluvia a la tarde, viento fuerte en altura…"
            />
          </label>
        </div>
      </Section>

      <Section
        title="Personal"
        icon={<HardHat className="size-4 text-accent" aria-hidden />}
      >
        <div className="space-y-3">
          {workforce.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border/70 p-3 sm:grid-cols-2"
            >
              <input
                placeholder="Nombre"
                value={row.workerName}
                onChange={(e) =>
                  setWorkforce((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, workerName: e.target.value } : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <input
                placeholder="Oficio / cargo"
                value={row.roleOrTrade ?? ""}
                onChange={(e) =>
                  setWorkforce((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, roleOrTrade: e.target.value } : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <input
                placeholder="Empresa"
                value={row.companyName ?? ""}
                onChange={(e) =>
                  setWorkforce((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, companyName: e.target.value } : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <input
                type="number"
                step="0.5"
                min={0}
                placeholder="Horas"
                value={row.hoursWorked}
                onChange={(e) =>
                  setWorkforce((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, hoursWorked: Number(e.target.value) }
                        : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <textarea
                placeholder="Notas de esta persona…"
                value={row.notes ?? ""}
                onChange={(e) =>
                  setWorkforce((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, notes: e.target.value } : r,
                    ),
                  )
                }
                rows={2}
                className={`${notesClass} sm:col-span-2`}
              />
              <button
                type="button"
                onClick={() =>
                  setWorkforce((prev) => prev.filter((_, i) => i !== index))
                }
                className="text-left text-xs text-danger sm:col-span-2"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setWorkforce((prev) => [
                ...prev,
                {
                  workerName: "",
                  roleOrTrade: "",
                  companyName: "",
                  hoursWorked: 8,
                  notes: "",
                },
              ])
            }
            className="text-sm text-accent hover:underline"
          >
            + Agregar persona
          </button>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Notas de personal
            </span>
            <textarea
              value={workforceNotes}
              onChange={(e) => setWorkforceNotes(e.target.value)}
              rows={2}
              className={notesClass}
              placeholder="Ej. Faltó cuadrilla de electricistas…"
            />
          </label>
        </div>
      </Section>

      <Section
        title="Máquinas / equipos"
        icon={<Wrench className="size-4 text-accent" aria-hidden />}
      >
        <div className="space-y-3">
          {equipment.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border/70 p-3 sm:grid-cols-2"
            >
              <input
                placeholder="Equipo"
                value={row.equipmentName}
                onChange={(e) =>
                  setEquipment((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, equipmentName: e.target.value }
                        : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <input
                type="number"
                step="0.5"
                min={0}
                placeholder="Horas"
                value={row.hoursUsed}
                onChange={(e) =>
                  setEquipment((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, hoursUsed: Number(e.target.value) }
                        : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <input
                placeholder="Operador"
                value={row.operatorName ?? ""}
                onChange={(e) =>
                  setEquipment((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, operatorName: e.target.value }
                        : r,
                    ),
                  )
                }
                className={`${fieldClass} sm:col-span-2`}
              />
              <textarea
                placeholder="Notas de este equipo…"
                value={row.notes ?? ""}
                onChange={(e) =>
                  setEquipment((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, notes: e.target.value } : r,
                    ),
                  )
                }
                rows={2}
                className={`${notesClass} sm:col-span-2`}
              />
              <button
                type="button"
                onClick={() =>
                  setEquipment((prev) => prev.filter((_, i) => i !== index))
                }
                className="text-left text-xs text-danger sm:col-span-2"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setEquipment((prev) => [
                ...prev,
                {
                  equipmentName: "",
                  hoursUsed: 0,
                  operatorName: "",
                  notes: "",
                },
              ])
            }
            className="text-sm text-accent hover:underline"
          >
            + Agregar equipo
          </button>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Notas de máquinas
            </span>
            <textarea
              value={equipmentNotes}
              onChange={(e) => setEquipmentNotes(e.target.value)}
              rows={2}
              className={notesClass}
              placeholder="Ej. Excavadora en mantenimiento…"
            />
          </label>
        </div>
      </Section>

      <Section
        title="Avances"
        icon={<TrendingUp className="size-4 text-accent" aria-hidden />}
      >
        <div className="space-y-3">
          {advances.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border/70 p-3 sm:grid-cols-3"
            >
              <input
                placeholder="Descripción"
                value={row.description}
                onChange={(e) =>
                  setAdvances((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, description: e.target.value }
                        : r,
                    ),
                  )
                }
                className={`${fieldClass} sm:col-span-3`}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cantidad"
                value={row.quantity}
                onChange={(e) =>
                  setAdvances((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, quantity: Number(e.target.value) }
                        : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <input
                placeholder="Unidad"
                value={row.unit ?? ""}
                onChange={(e) =>
                  setAdvances((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, unit: e.target.value } : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() =>
                  setAdvances((prev) => prev.filter((_, i) => i !== index))
                }
                className="text-left text-xs text-danger"
              >
                Quitar
              </button>
              <textarea
                placeholder="Notas de este avance…"
                value={row.notes ?? ""}
                onChange={(e) =>
                  setAdvances((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, notes: e.target.value } : r,
                    ),
                  )
                }
                rows={2}
                className={`${notesClass} sm:col-span-3`}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setAdvances((prev) => [
                ...prev,
                { description: "", quantity: 0, unit: "", notes: "" },
              ])
            }
            className="text-sm text-accent hover:underline"
          >
            + Agregar avance
          </button>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Notas de avances
            </span>
            <textarea
              value={advanceNotes}
              onChange={(e) => setAdvanceNotes(e.target.value)}
              rows={2}
              className={notesClass}
              placeholder="Ej. Hormigonado de losa 2° piso…"
            />
          </label>
        </div>
      </Section>

      <Section
        title="Incidencias"
        icon={<TriangleAlert className="size-4 text-accent" aria-hidden />}
      >
        <div className="space-y-3">
          {incidents.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border/70 p-3 sm:grid-cols-2"
            >
              <input
                placeholder="Título"
                value={row.title}
                onChange={(e) =>
                  setIncidents((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, title: e.target.value } : r,
                    ),
                  )
                }
                className={fieldClass}
              />
              <select
                value={row.severity}
                onChange={(e) =>
                  setIncidents((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? {
                            ...r,
                            severity: e.target.value as PunchListPriority,
                          }
                        : r,
                    ),
                  )
                }
                className={fieldClass}
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Descripción…"
                value={row.description ?? ""}
                onChange={(e) =>
                  setIncidents((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, description: e.target.value }
                        : r,
                    ),
                  )
                }
                rows={2}
                className={`${notesClass} sm:col-span-2`}
              />
              <textarea
                placeholder="Notas de esta incidencia…"
                value={row.notes ?? ""}
                onChange={(e) =>
                  setIncidents((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, notes: e.target.value } : r,
                    ),
                  )
                }
                rows={2}
                className={`${notesClass} sm:col-span-2`}
              />
              <button
                type="button"
                onClick={() =>
                  setIncidents((prev) => prev.filter((_, i) => i !== index))
                }
                className="text-left text-xs text-danger sm:col-span-2"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setIncidents((prev) => [
                ...prev,
                {
                  title: "",
                  description: "",
                  notes: "",
                  severity: "MEDIUM",
                },
              ])
            }
            className="text-sm text-accent hover:underline"
          >
            + Agregar incidencia
          </button>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Notas de incidencias
            </span>
            <textarea
              value={incidentNotes}
              onChange={(e) => setIncidentNotes(e.target.value)}
              rows={2}
              className={notesClass}
              placeholder="Ej. Se notificó a Higiene y Seguridad…"
            />
          </label>
        </div>
      </Section>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
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
            onClick={() => router.back()}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending
              ? "Guardando…"
              : initial
                ? "Guardar cambios"
                : "Crear parte"}
          </button>
        </div>
      </div>
    </form>
  );
}
