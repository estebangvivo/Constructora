import type { PunchListPriority, WeatherCondition } from "@prisma/client";

export const WEATHER_LABEL: Record<WeatherCondition, string> = {
  CLEAR: "Despejado",
  CLOUDY: "Nublado",
  RAIN: "Lluvia",
  STORM: "Tormenta",
  WIND: "Viento",
  FOG: "Niebla",
  OTHER: "Otro",
};

export const WEATHER_OPTIONS = Object.keys(WEATHER_LABEL) as WeatherCondition[];

export const SEVERITY_LABEL: Record<PunchListPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const SEVERITY_STYLE: Record<PunchListPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-accent/15 text-accent",
  HIGH: "bg-warning/15 text-warning",
  CRITICAL: "bg-danger/15 text-danger",
};

export const SEVERITY_OPTIONS = Object.keys(
  SEVERITY_LABEL,
) as PunchListPriority[];
