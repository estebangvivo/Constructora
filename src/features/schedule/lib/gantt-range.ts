/** Utilidades de calendario para el Gantt (días locales, sin zona UTC). */

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDays(value: Date, days: number): Date {
  const d = startOfDay(value);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function parseLocalDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type GanttScale = "day" | "week";

export type GanttRange = {
  start: Date;
  end: Date;
  totalDays: number;
  scale: GanttScale;
  columns: { label: string; sublabel: string; start: Date; days: number }[];
};

const MONTH_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function buildGanttRange(dates: (Date | null | undefined)[]): GanttRange {
  const valid = dates
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .map(startOfDay);

  const today = startOfDay(new Date());
  let start = valid.length
    ? new Date(Math.min(...valid.map((d) => d.getTime())))
    : addDays(today, -14);
  let end = valid.length
    ? new Date(Math.max(...valid.map((d) => d.getTime())))
    : addDays(today, 45);

  if (end.getTime() <= start.getTime()) {
    end = addDays(start, 30);
  }

  start = addDays(start, -3);
  end = addDays(end, 7);

  let totalDays = daysBetween(start, end) + 1;
  if (totalDays < 21) {
    end = addDays(start, 20);
    totalDays = 21;
  }

  const scale: GanttScale = totalDays > 90 ? "week" : "day";
  const columns: GanttRange["columns"] = [];

  if (scale === "day") {
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(start, i);
      columns.push({
        label: String(day.getDate()),
        sublabel: MONTH_SHORT[day.getMonth()],
        start: day,
        days: 1,
      });
    }
  } else {
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      const weekEnd = addDays(cursor, 6);
      const clippedEnd = weekEnd.getTime() > end.getTime() ? end : weekEnd;
      const days = daysBetween(cursor, clippedEnd) + 1;
      columns.push({
        label: `${cursor.getDate()} ${MONTH_SHORT[cursor.getMonth()]}`,
        sublabel: `sem`,
        start: cursor,
        days,
      });
      cursor = addDays(clippedEnd, 1);
    }
  }

  return { start, end, totalDays, scale, columns };
}

export function barStyle(
  range: GanttRange,
  start: Date | null,
  end: Date | null,
): { left: string; width: string } | null {
  if (!start || !end) return null;
  const s = startOfDay(start);
  const e = startOfDay(end);
  if (e.getTime() < s.getTime()) return null;

  const offset = daysBetween(range.start, s);
  const span = daysBetween(s, e) + 1;
  if (offset + span < 0 || offset > range.totalDays) return null;

  const leftPct = (offset / range.totalDays) * 100;
  const widthPct = (span / range.totalDays) * 100;
  return {
    left: `${Math.max(0, leftPct)}%`,
    width: `${Math.min(100 - Math.max(0, leftPct), Math.max(widthPct, 0.8))}%`,
  };
}

export function markerLeft(
  range: GanttRange,
  date: Date | null,
): string | null {
  if (!date) return null;
  const offset = daysBetween(range.start, startOfDay(date));
  if (offset < 0 || offset > range.totalDays) return null;
  return `${(offset / range.totalDays) * 100}%`;
}
