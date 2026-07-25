"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCertification,
  updateCertification,
  type CertLineInput,
} from "@/features/certifications/actions/certification-actions";
import type { CertifiableBudgetItem } from "@/features/certifications/queries/list-certifications";
import { formatCertMoney, round2, roundPct } from "@/features/certifications/lib/labels";

type LineState = {
  budgetItemId: string;
  code: string;
  description: string;
  totalCost: number;
  previousPct: number;
  currentPct: number;
  selected: boolean;
};

type CertificationFormProps = {
  projectId: string;
  currency: string;
  budgetItems: CertifiableBudgetItem[];
  mode?: "create" | "edit";
  certificationId?: string;
  initial?: {
    periodStart: string;
    periodEnd: string;
    retentionPct: number;
    notes: string;
    lines: {
      budgetItemId: string;
      currentPct: number;
    }[];
  };
};

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

function monthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function CertificationForm({
  projectId,
  currency,
  budgetItems,
  mode = "create",
  certificationId,
  initial,
}: CertificationFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bounds = monthBounds();
  const [periodStart, setPeriodStart] = useState(
    initial?.periodStart ?? bounds.start,
  );
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? bounds.end);
  const [retentionPct, setRetentionPct] = useState(
    initial?.retentionPct ?? 5,
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const initialSelected = new Map(
    (initial?.lines ?? []).map((l) => [l.budgetItemId, l.currentPct]),
  );

  const [lines, setLines] = useState<LineState[]>(() =>
    budgetItems.map((item) => {
      const current = initialSelected.get(item.id);
      return {
        budgetItemId: item.id,
        code: item.code,
        description: item.description,
        totalCost: item.totalCost,
        previousPct: item.previousPct,
        currentPct: current ?? item.previousPct,
        selected: current != null ? current > item.previousPct : false,
      };
    }),
  );

  const selectedLines = useMemo(
    () =>
      lines.filter((l) => l.selected && l.currentPct > l.previousPct),
    [lines],
  );

  const gross = useMemo(
    () =>
      round2(
        selectedLines.reduce((acc, l) => {
          const period = roundPct(l.currentPct - l.previousPct);
          return acc + (l.totalCost * period) / 100;
        }, 0),
      ),
    [selectedLines],
  );
  const retentionAmount = round2((gross * (Number(retentionPct) || 0)) / 100);
  const net = round2(gross - retentionAmount);

  function updateLine(budgetItemId: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((l) =>
        l.budgetItemId === budgetItemId ? { ...l, ...patch } : l,
      ),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payloadLines: CertLineInput[] = selectedLines.map((l) => ({
      budgetItemId: l.budgetItemId,
      currentPct: Number(l.currentPct),
    }));

    startTransition(async () => {
      const result =
        mode === "edit" && certificationId
          ? await updateCertification({
              certificationId,
              periodStart,
              periodEnd,
              retentionPct: Number(retentionPct) || 0,
              notes: notes || undefined,
              lines: payloadLines,
            })
          : await createCertification({
              projectId,
              periodStart,
              periodEnd,
              retentionPct: Number(retentionPct) || 0,
              notes: notes || undefined,
              lines: payloadLines,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/projects/${projectId}/certifications/${result.id}`);
      router.refresh();
    });
  }

  if (budgetItems.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Esta obra no tiene partidas de presupuesto. Primero cargá el presupuesto.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Inicio del período
          </span>
          <input
            type="date"
            required
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Fin del período
          </span>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Retención de garantía (%)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={retentionPct}
            onChange={(e) => setRetentionPct(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={fieldClass}
          />
        </label>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-medium">Avance por partida</h3>
          <p className="text-sm text-muted-foreground">
            Marcá las partidas y cargá el % acumulado a la fecha. El avance del
            período = acumulado − ya certificado.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-2 font-medium"> </th>
                <th className="py-2 pr-2 font-medium">Código</th>
                <th className="py-2 pr-2 font-medium">Descripción</th>
                <th className="py-2 pr-2 text-right font-medium">Presup.</th>
                <th className="py-2 pr-2 text-right font-medium">Ya cert.</th>
                <th className="py-2 pr-2 text-right font-medium">Acum. %</th>
                <th className="py-2 text-right font-medium">Período $</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const periodPct = Math.max(
                  0,
                  roundPct(line.currentPct - line.previousPct),
                );
                const amount = round2((line.totalCost * periodPct) / 100);
                return (
                  <tr
                    key={line.budgetItemId}
                    className="border-b border-border/70"
                  >
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={line.selected}
                        onChange={(e) =>
                          updateLine(line.budgetItemId, {
                            selected: e.target.checked,
                            currentPct:
                              e.target.checked &&
                              line.currentPct <= line.previousPct
                                ? Math.min(100, line.previousPct + 1)
                                : line.currentPct,
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">{line.code}</td>
                    <td className="py-2 pr-2">{line.description}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {formatCertMoney(line.totalCost, currency)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                      {line.previousPct}%
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input
                        type="number"
                        min={line.previousPct}
                        max={100}
                        step="0.01"
                        disabled={!line.selected}
                        value={line.currentPct}
                        onChange={(e) =>
                          updateLine(line.budgetItemId, {
                            currentPct: Number(e.target.value),
                          })
                        }
                        className={`${fieldClass} max-w-[6rem] text-right disabled:opacity-50`}
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {line.selected
                        ? formatCertMoney(amount, currency)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Bruto</dt>
          <dd className="font-display text-xl">
            {formatCertMoney(gross, currency)}
          </dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs uppercase text-muted-foreground">
            Retención ({retentionPct || 0}%)
          </dt>
          <dd className="font-display text-xl">
            {formatCertMoney(retentionAmount, currency)}
          </dd>
        </div>
        <div className="border-l-2 border-accent pl-3">
          <dt className="text-xs uppercase text-muted-foreground">Neto</dt>
          <dd className="font-display text-xl">
            {formatCertMoney(net, currency)}
          </dd>
        </div>
      </dl>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
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
            : mode === "edit"
              ? "Guardar cambios"
              : "Crear certificación"}
        </button>
      </div>
    </form>
  );
}
