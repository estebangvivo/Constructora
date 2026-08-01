import type { OrganizationRole } from "@prisma/client";
import type { AppRole } from "@/types";

/** Claves estables de módulos (permisos + navegación). */
export const APP_MODULE_KEYS = [
  "home",
  "projects",
  "treasury",
  "clients",
  "suppliers",
  "settings",
  "users",
  "admin",
  "manual",
  "turnero",
  "featureRequests",
  "project.overview",
  "project.stakeholders",
  "project.budget",
  "project.certifications",
  "project.changeOrders",
  "project.schedule",
  "project.dailyReport",
  "project.punchList",
  "project.documents",
  "project.purchases",
  "project.inventory",
  "project.contractors",
] as const;

export type AppModuleKey = (typeof APP_MODULE_KEYS)[number];

export type AppModuleDef = {
  key: AppModuleKey;
  label: string;
  group: "global" | "obra";
  /** Prefijos de ruta que requieren este módulo */
  pathPrefixes: string[];
};

export const APP_MODULES: AppModuleDef[] = [
  { key: "home", label: "Inicio", group: "global", pathPrefixes: ["/"] },
  {
    key: "projects",
    label: "Obras (listado)",
    group: "global",
    pathPrefixes: ["/projects"],
  },
  {
    key: "treasury",
    label: "Tesorería",
    group: "global",
    pathPrefixes: ["/treasury"],
  },
  {
    key: "clients",
    label: "Clientes",
    group: "global",
    pathPrefixes: ["/clients"],
  },
  {
    key: "suppliers",
    label: "Proveedores",
    group: "global",
    pathPrefixes: ["/suppliers"],
  },
  {
    key: "settings",
    label: "Configuración",
    group: "global",
    pathPrefixes: ["/settings"],
  },
  {
    key: "users",
    label: "Usuarios y permisos",
    group: "global",
    pathPrefixes: ["/settings/users"],
  },
  {
    key: "admin",
    label: "Administración",
    group: "global",
    pathPrefixes: ["/admin"],
  },
  {
    key: "manual",
    label: "Manual",
    group: "global",
    pathPrefixes: ["/manual"],
  },
  {
    key: "turnero",
    label: "Turnero",
    group: "global",
    pathPrefixes: ["/turnero"],
  },
  {
    key: "featureRequests",
    label: "Solicitudes de mejora",
    group: "global",
    pathPrefixes: ["/solicitudes"],
  },
  {
    key: "project.overview",
    label: "Obra · Resumen",
    group: "obra",
    pathPrefixes: [],
  },
  {
    key: "project.stakeholders",
    label: "Obra · Cliente y proveedores",
    group: "obra",
    pathPrefixes: ["/stakeholders"],
  },
  {
    key: "project.budget",
    label: "Obra · Presupuesto",
    group: "obra",
    pathPrefixes: ["/budget"],
  },
  {
    key: "project.certifications",
    label: "Obra · Certificaciones",
    group: "obra",
    pathPrefixes: ["/certifications"],
  },
  {
    key: "project.changeOrders",
    label: "Obra · Órdenes de cambio",
    group: "obra",
    pathPrefixes: ["/change-orders"],
  },
  {
    key: "project.schedule",
    label: "Obra · Cronograma",
    group: "obra",
    pathPrefixes: ["/schedule"],
  },
  {
    key: "project.dailyReport",
    label: "Obra · Parte diario",
    group: "obra",
    pathPrefixes: ["/daily-report"],
  },
  {
    key: "project.punchList",
    label: "Obra · Punch List",
    group: "obra",
    pathPrefixes: ["/punch-list"],
  },
  {
    key: "project.documents",
    label: "Obra · Documentos",
    group: "obra",
    pathPrefixes: ["/documents"],
  },
  {
    key: "project.purchases",
    label: "Obra · Compras",
    group: "obra",
    pathPrefixes: ["/purchases"],
  },
  {
    key: "project.inventory",
    label: "Obra · Inventario",
    group: "obra",
    pathPrefixes: ["/inventory"],
  },
  {
    key: "project.contractors",
    label: "Obra · Subcontratas",
    group: "obra",
    pathPrefixes: ["/contractors"],
  },
];

/** Defaults por rol cuando allowedModules está vacío. */
export const ROLE_DEFAULT_MODULES: Record<OrganizationRole, AppModuleKey[]> = {
  ADMIN: [...APP_MODULE_KEYS],
  DIRECTOR: APP_MODULE_KEYS.filter((k) => k !== "admin"),
  RESIDENT: [
    "home",
    "projects",
    "treasury",
    "clients",
    "suppliers",
    "manual",
    "turnero",
    "featureRequests",
    "project.overview",
    "project.stakeholders",
    "project.budget",
    "project.certifications",
    "project.changeOrders",
    "project.schedule",
    "project.dailyReport",
    "project.punchList",
    "project.documents",
    "project.purchases",
    "project.inventory",
    "project.contractors",
  ],
  PROVIDER: [
    "home",
    "projects",
    "manual",
    "featureRequests",
    "project.overview",
    "project.documents",
    "project.contractors",
  ],
  VIEWER: [
    "home",
    "projects",
    "manual",
    "featureRequests",
    "project.overview",
    "project.schedule",
    "project.dailyReport",
    "project.punchList",
    "project.documents",
  ],
};

export function resolveAllowedModules(
  role: OrganizationRole | AppRole,
  stored: string[] | null | undefined,
): AppModuleKey[] {
  if (role === "ADMIN") return [...APP_MODULE_KEYS];
  if (stored && stored.length > 0) {
    const set = new Set(stored);
    return APP_MODULE_KEYS.filter((k) => set.has(k));
  }
  return [...ROLE_DEFAULT_MODULES[role as OrganizationRole]];
}

export function hasModule(
  modules: AppModuleKey[] | string[],
  key: AppModuleKey,
): boolean {
  return modules.includes(key);
}

/** Mapeo href sidebar → módulo */
export const SIDEBAR_MODULE_BY_HREF: Record<string, AppModuleKey> = {
  "/": "home",
  "/projects": "projects",
  "/treasury": "treasury",
  "/clients": "clients",
  "/suppliers": "suppliers",
  "/settings": "settings",
  "/admin": "admin",
  "/manual": "manual",
  "/turnero": "turnero",
  "/solicitudes": "featureRequests",
};

/** Mapeo suffix project nav → módulo */
export const PROJECT_MODULE_BY_SUFFIX: Record<string, AppModuleKey> = {
  "": "project.overview",
  "/stakeholders": "project.stakeholders",
  "/budget": "project.budget",
  "/certifications": "project.certifications",
  "/change-orders": "project.changeOrders",
  "/schedule": "project.schedule",
  "/daily-report": "project.dailyReport",
  "/punch-list": "project.punchList",
  "/documents": "project.documents",
  "/purchases": "project.purchases",
  "/inventory": "project.inventory",
  "/contractors": "project.contractors",
};

export function moduleForPathname(pathname: string): AppModuleKey | null {
  if (pathname.startsWith("/settings/users")) return "users";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/treasury")) return "treasury";
  if (pathname.startsWith("/clients")) return "clients";
  if (pathname.startsWith("/suppliers")) return "suppliers";
  if (pathname.startsWith("/manual")) return "manual";
  if (pathname.startsWith("/turnero")) return "turnero";
  if (pathname.startsWith("/solicitudes")) return "featureRequests";
  if (pathname === "/" || pathname === "") return "home";

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(\/.*)?$/);
  if (projectMatch) {
    const suffix = projectMatch[2] ?? "";
    if (!suffix || suffix === "/") return "project.overview";
    for (const [suf, key] of Object.entries(PROJECT_MODULE_BY_SUFFIX)) {
      if (suf && (suffix === suf || suffix.startsWith(`${suf}/`))) {
        return key;
      }
    }
    return "projects";
  }

  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
    return null;
  }
  return "home";
}
