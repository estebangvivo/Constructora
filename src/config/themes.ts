/**
 * Paletas de color de la organización.
 * Cada paleta define las CSS variables usadas en globals.css.
 */

import type { CSSProperties } from "react";

export type ThemeVars = {
  background: string;
  foreground: string;
  surface: string;
  surfaceElevated: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarHover: string;
  sidebarActive: string;
  muted: string;
  mutedForeground: string;
  border: string;
  accent: string;
  accentForeground: string;
  success: string;
  warning: string;
  danger: string;
};

export type ColorPalette = {
  id: string;
  name: string;
  description: string;
  /** Tres swatches para preview: fondo, acento, sidebar */
  swatches: [string, string, string];
  vars: ThemeVars;
};

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: "obra",
    name: "Obra ámbar",
    description: "Hormigón claro con acento de seguridad industrial.",
    swatches: ["#f3f1ec", "#b45309", "#1c1917"],
    vars: {
      background: "#f3f1ec",
      foreground: "#1c1917",
      surface: "#faf9f6",
      surfaceElevated: "#ffffff",
      sidebar: "#1c1917",
      sidebarForeground: "#e7e5e4",
      sidebarHover: "#292524",
      sidebarActive: "#44403c",
      muted: "#e7e5e4",
      mutedForeground: "#78716c",
      border: "#d6d3d1",
      accent: "#b45309",
      accentForeground: "#fffbeb",
      success: "#047857",
      warning: "#b45309",
      danger: "#b91c1c",
    },
  },
  {
    id: "acero",
    name: "Acero",
    description: "Grises fríos y azul estructural.",
    swatches: ["#eef1f4", "#2563eb", "#0f172a"],
    vars: {
      background: "#eef1f4",
      foreground: "#0f172a",
      surface: "#f8fafc",
      surfaceElevated: "#ffffff",
      sidebar: "#0f172a",
      sidebarForeground: "#e2e8f0",
      sidebarHover: "#1e293b",
      sidebarActive: "#334155",
      muted: "#e2e8f0",
      mutedForeground: "#64748b",
      border: "#cbd5e1",
      accent: "#2563eb",
      accentForeground: "#eff6ff",
      success: "#0f766e",
      warning: "#c2410c",
      danger: "#be123c",
    },
  },
  {
    id: "bosque",
    name: "Bosque",
    description: "Verdes de obra y piedra clara.",
    swatches: ["#f0f2ed", "#3f6212", "#1a2e05"],
    vars: {
      background: "#f0f2ed",
      foreground: "#1a2e05",
      surface: "#f7f8f4",
      surfaceElevated: "#ffffff",
      sidebar: "#1a2e05",
      sidebarForeground: "#e8edd9",
      sidebarHover: "#243d1a",
      sidebarActive: "#365314",
      muted: "#e4e8dc",
      mutedForeground: "#6b7280",
      border: "#d1d5c8",
      accent: "#3f6212",
      accentForeground: "#f7fee7",
      success: "#166534",
      warning: "#a16207",
      danger: "#b91c1c",
    },
  },
  {
    id: "grafito",
    name: "Grafito",
    description: "Carbón con amarillo de señalización.",
    swatches: ["#ececeb", "#ca8a04", "#18181b"],
    vars: {
      background: "#ececeb",
      foreground: "#18181b",
      surface: "#f4f4f5",
      surfaceElevated: "#ffffff",
      sidebar: "#18181b",
      sidebarForeground: "#e4e4e7",
      sidebarHover: "#27272a",
      sidebarActive: "#3f3f46",
      muted: "#e4e4e7",
      mutedForeground: "#71717a",
      border: "#d4d4d8",
      accent: "#ca8a04",
      accentForeground: "#422006",
      success: "#15803d",
      warning: "#ca8a04",
      danger: "#dc2626",
    },
  },
  {
    id: "arcilla",
    name: "Arcilla",
    description: "Tonos tierra y ladrillo quemado.",
    swatches: ["#f2ebe4", "#9a3412", "#292524"],
    vars: {
      background: "#f2ebe4",
      foreground: "#1c1917",
      surface: "#faf6f1",
      surfaceElevated: "#ffffff",
      sidebar: "#292524",
      sidebarForeground: "#e7e5e4",
      sidebarHover: "#3f3a36",
      sidebarActive: "#57534e",
      muted: "#e7e0d8",
      mutedForeground: "#78716c",
      border: "#d6cbc0",
      accent: "#9a3412",
      accentForeground: "#fff7ed",
      success: "#3f6212",
      warning: "#b45309",
      danger: "#b91c1c",
    },
  },
  {
    id: "senal",
    name: "Señal",
    description: "Negro industrial con naranja de obra.",
    swatches: ["#f4f4f5", "#ea580c", "#0a0a0a"],
    vars: {
      background: "#f4f4f5",
      foreground: "#0a0a0a",
      surface: "#fafafa",
      surfaceElevated: "#ffffff",
      sidebar: "#0a0a0a",
      sidebarForeground: "#f4f4f5",
      sidebarHover: "#171717",
      sidebarActive: "#262626",
      muted: "#e5e5e5",
      mutedForeground: "#737373",
      border: "#d4d4d4",
      accent: "#ea580c",
      accentForeground: "#fff7ed",
      success: "#15803d",
      warning: "#ea580c",
      danger: "#dc2626",
    },
  },
  {
    id: "fuego",
    name: "Fuego",
    description: "Menú naranja; contenido negro con tipografía naranja.",
    swatches: ["#0a0a0a", "#ea580c", "#c2410c"],
    vars: {
      background: "#0a0a0a",
      foreground: "#fb923c",
      surface: "#141414",
      surfaceElevated: "#1a1a1a",
      sidebar: "#ea580c",
      sidebarForeground: "#0a0a0a",
      sidebarHover: "#f97316",
      sidebarActive: "#c2410c",
      muted: "#262626",
      mutedForeground: "#fdba74",
      border: "#292524",
      accent: "#ea580c",
      accentForeground: "#0a0a0a",
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#f87171",
    },
  },
  {
    id: "mar",
    name: "Mar",
    description: "Turquesa de costa y arena fría.",
    swatches: ["#ecf3f4", "#0f766e", "#134e4a"],
    vars: {
      background: "#ecf3f4",
      foreground: "#134e4a",
      surface: "#f5fafb",
      surfaceElevated: "#ffffff",
      sidebar: "#134e4a",
      sidebarForeground: "#ccfbf1",
      sidebarHover: "#115e59",
      sidebarActive: "#0f766e",
      muted: "#d8e8ea",
      mutedForeground: "#5b7a7c",
      border: "#b8d0d3",
      accent: "#0f766e",
      accentForeground: "#f0fdfa",
      success: "#047857",
      warning: "#b45309",
      danger: "#be123c",
    },
  },
];

export const DEFAULT_THEME_ID = "obra";

export function getColorPalette(
  themeId: string | null | undefined,
): ColorPalette {
  return (
    COLOR_PALETTES.find((p) => p.id === themeId) ??
    COLOR_PALETTES.find((p) => p.id === DEFAULT_THEME_ID)!
  );
}

export function themeToInlineStyle(
  themeId: string | null | undefined,
): CSSProperties {
  const { vars } = getColorPalette(themeId);
  return {
    ["--background" as string]: vars.background,
    ["--foreground" as string]: vars.foreground,
    ["--surface" as string]: vars.surface,
    ["--surface-elevated" as string]: vars.surfaceElevated,
    ["--sidebar" as string]: vars.sidebar,
    ["--sidebar-foreground" as string]: vars.sidebarForeground,
    ["--sidebar-hover" as string]: vars.sidebarHover,
    ["--sidebar-active" as string]: vars.sidebarActive,
    ["--muted" as string]: vars.muted,
    ["--muted-foreground" as string]: vars.mutedForeground,
    ["--border" as string]: vars.border,
    ["--accent" as string]: vars.accent,
    ["--accent-foreground" as string]: vars.accentForeground,
    ["--success" as string]: vars.success,
    ["--warning" as string]: vars.warning,
    ["--danger" as string]: vars.danger,
  };
}

export function themeToCssText(themeId: string | null | undefined): string {
  const style = themeToInlineStyle(themeId);
  return Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

export function applyThemeToDocument(themeId: string | null | undefined) {
  if (typeof document === "undefined") return;
  const style = themeToInlineStyle(themeId);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(style)) {
    if (typeof value === "string") {
      root.style.setProperty(key, value);
    }
  }
}
