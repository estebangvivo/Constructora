/**
 * Mapa de módulos del ERP Constructora.
 * Fuente de verdad para navegación, permisos y lazy-loading de features.
 */
export const MODULES = {
  projects: {
    id: "projects",
    label: "Obras",
    basePath: "/projects",
  },
  clients: {
    id: "clients",
    label: "Clientes",
    basePath: "/clients",
  },
  suppliers: {
    id: "suppliers",
    label: "Proveedores",
    basePath: "/suppliers",
  },
  treasury: {
    id: "treasury",
    label: "Tesorería",
    basePath: "/treasury",
  },
  stakeholders: {
    id: "stakeholders",
    label: "Cliente y proveedores",
    basePath: "/stakeholders",
    parent: "projects",
  },
  budget: {
    id: "budget",
    label: "Presupuesto",
    basePath: "/budget",
    parent: "projects",
  },
  certifications: {
    id: "certifications",
    label: "Certificaciones",
    basePath: "/certifications",
    parent: "projects",
  },
  changeOrders: {
    id: "change-orders",
    label: "Órdenes de Cambio",
    basePath: "/change-orders",
    parent: "projects",
  },
  dailyReport: {
    id: "daily-report",
    label: "Parte Diario",
    basePath: "/daily-report",
    parent: "projects",
    offlineCapable: true,
  },
  punchList: {
    id: "punch-list",
    label: "Punch List",
    basePath: "/punch-list",
    parent: "projects",
    offlineCapable: true,
  },
  schedule: {
    id: "schedule",
    label: "Cronograma",
    basePath: "/schedule",
    parent: "projects",
  },
  documents: {
    id: "documents",
    label: "Documentos",
    basePath: "/documents",
    parent: "projects",
  },
  purchases: {
    id: "purchases",
    label: "Compras",
    basePath: "/purchases",
    parent: "projects",
  },
  inventory: {
    id: "inventory",
    label: "Inventario",
    basePath: "/inventory",
    parent: "projects",
  },
  contractors: {
    id: "contractors",
    label: "Subcontratas",
    basePath: "/contractors",
    parent: "projects",
  },
  settings: {
    id: "settings",
    label: "Configuración",
    basePath: "/settings",
  },
} as const;

export type ModuleId = keyof typeof MODULES;
