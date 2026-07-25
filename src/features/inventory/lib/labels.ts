export const INVENTORY_CATEGORY_SUGGESTIONS = [
  "General",
  "Hierros",
  "Hormigón",
  "Áridos",
  "Madera",
  "Electricidad",
  "Sanitarios",
  "Pintura",
  "Herramientas",
  "Seguridad",
  "Ferretería",
  "Combustible",
  "Otros",
] as const;

export function normalizeInventoryName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeInventoryCategory(category?: string | null) {
  const value = category?.trim();
  return value && value.length > 0 ? value : "General";
}

export function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function formatQty(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 4,
  }).format(value);
}
