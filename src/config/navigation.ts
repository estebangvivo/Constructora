import type { AppRole } from "@/types";
import {
  PROJECT_MODULE_BY_SUFFIX,
  SIDEBAR_MODULE_BY_HREF,
  type AppModuleKey,
} from "@/features/auth/lib/modules";
import {
  Building2,
  ClipboardList,
  FileStack,
  FolderKanban,
  HardHat,
  LayoutDashboard,
  MapPinned,
  Package,
  Settings,
  ShoppingCart,
  TriangleAlert,
  Wallet,
  CalendarRange,
  FileDiff,
  BadgePercent,
  Users,
  Truck,
  Handshake,
  Banknote,
  BookOpen,
  Ticket,
  Shield,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  roles?: AppRole[];
  fieldPriority?: boolean;
  module?: AppModuleKey;
  /** Solo visible para superadmin de plataforma (no rol Admin de empresa). */
  platformSuperadminOnly?: boolean;
};

export const SIDEBAR_NAV: NavItem[] = [
  { title: "Inicio", href: "/", icon: LayoutDashboard, module: "home" },
  {
    title: "Presupuestos",
    href: "/proposals",
    icon: FileStack,
    description: "Cotizaciones previas; al aprobar se crea la obra",
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "proposals",
  },
  {
    title: "Obras",
    href: "/projects",
    icon: FolderKanban,
    description: "Proyectos, avance y módulos de cada obra",
    module: "projects",
  },
  {
    title: "Datos en Obra",
    href: "/campo",
    icon: MapPinned,
    description: "Acceso rápido a parte diario y punch list",
    module: "projects",
    fieldPriority: true,
  },
  {
    title: "Tesorería",
    href: "/treasury",
    icon: Banknote,
    description: "Recibos, órdenes de pago, caja diaria y tesorería",
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "treasury",
  },
  {
    title: "Clientes",
    href: "/clients",
    icon: Users,
    description: "Catálogo de clientes y mandantes",
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "clients",
  },
  {
    title: "Proveedores",
    href: "/suppliers",
    icon: Truck,
    description: "Proveedores de materiales y servicios",
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "suppliers",
  },
  {
    title: "Configuración",
    href: "/settings",
    icon: Settings,
    description: "Datos de la constructora, logo y contacto",
    roles: ["ADMIN", "DIRECTOR"],
    module: "settings",
  },
  {
    title: "Administración",
    href: "/admin",
    icon: Shield,
    description: "Panel de plataforma: empresas, billing y gastos de sistema",
    platformSuperadminOnly: true,
    module: "admin",
  },
  {
    title: "Turnero",
    href: "/turnero",
    icon: Ticket,
    description: "Tótem, operador y pantalla de la cola de atención",
    module: "turnero",
  },
  {
    title: "Manual",
    href: "/manual",
    icon: BookOpen,
    description: "Guía completa de uso del sistema",
    module: "manual",
  },
  {
    title: "Mejoras",
    href: "/solicitudes",
    icon: Lightbulb,
    description: "Solicitar mejoras o cambios al sistema",
    module: "featureRequests",
  },
];

export const PROJECT_NAV: NavItem[] = [
  { title: "Resumen", href: "", icon: Building2, module: "project.overview" },
  {
    title: "Cliente y proveedores",
    href: "/stakeholders",
    icon: Handshake,
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "project.stakeholders",
  },
  {
    title: "Presupuesto",
    href: "/budget",
    icon: Wallet,
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "project.budget",
  },
  {
    title: "Certificaciones",
    href: "/certifications",
    icon: BadgePercent,
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "project.certifications",
  },
  {
    title: "Órdenes de Cambio",
    href: "/change-orders",
    icon: FileDiff,
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "project.changeOrders",
  },
  {
    title: "Cronograma",
    href: "/schedule",
    icon: CalendarRange,
    module: "project.schedule",
  },
  {
    title: "Parte Diario",
    href: "/daily-report",
    icon: ClipboardList,
    fieldPriority: true,
    module: "project.dailyReport",
  },
  {
    title: "Punch List",
    href: "/punch-list",
    icon: TriangleAlert,
    fieldPriority: true,
    module: "project.punchList",
  },
  {
    title: "Documentos",
    href: "/documents",
    icon: FileStack,
    module: "project.documents",
  },
  {
    title: "Compras",
    href: "/purchases",
    icon: ShoppingCart,
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "project.purchases",
  },
  {
    title: "Inventario",
    href: "/inventory",
    icon: Package,
    roles: ["ADMIN", "DIRECTOR", "RESIDENT"],
    module: "project.inventory",
  },
  {
    title: "Subcontratas",
    href: "/contractors",
    icon: HardHat,
    roles: ["ADMIN", "DIRECTOR", "RESIDENT", "PROVIDER"],
    module: "project.contractors",
  },
];

export function projectHref(projectId: string, suffix = ""): string {
  return `/projects/${projectId}${suffix}`;
}

export function filterNavByRole(
  items: NavItem[],
  role?: AppRole | null,
): NavItem[] {
  if (!role) {
    return items.filter((item) => !item.roles);
  }
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

/** Filtra por módulos permitidos; si no hay lista, cae al filtro por rol. */
export function filterNavByAccess(
  items: NavItem[],
  opts: {
    role?: AppRole | null;
    modules?: AppModuleKey[] | string[] | null;
    isPlatformSuperadmin?: boolean;
  },
): NavItem[] {
  const byRole = filterNavByRole(items, opts.role).filter((item) => {
    if (!item.platformSuperadminOnly) return true;
    return Boolean(opts.isPlatformSuperadmin);
  });
  if (!opts.modules || opts.modules.length === 0) return byRole;
  const set = new Set(opts.modules);
  return byRole.filter((item) => {
    if (item.platformSuperadminOnly) return true;
    const mod =
      item.module ??
      SIDEBAR_MODULE_BY_HREF[item.href] ??
      PROJECT_MODULE_BY_SUFFIX[item.href];
    if (!mod) return true;
    return set.has(mod);
  });
}

export const FIELD_SHORTCUTS: NavItem[] = PROJECT_NAV.filter(
  (item) => item.fieldPriority,
);
