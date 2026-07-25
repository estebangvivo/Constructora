import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Banknote,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardList,
  FileDiff,
  FileStack,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

export type ManualShot = {
  src: string;
  alt: string;
  caption?: string;
};

export type ManualSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  steps: string[];
  tips?: string[];
  shots: ManualShot[];
};

export const MANUAL_INTRO = {
  title: "Manual de uso",
  subtitle:
    "Guía completa para aprender el sistema desde cero: obras, campo, compras, inventario y tesorería.",
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "primeros-pasos",
    title: "1. Primeros pasos",
    icon: LayoutDashboard,
    summary:
      "Al entrar vas al Inicio. El menú izquierdo (en celular, el botón de menú) concentra lo de la empresa; cada obra tiene su propio menú interno.",
    steps: [
      "Abrí el sistema en el navegador e iniciá sesión (o usá el acceso de desarrollo si te lo configuraron).",
      "En Inicio vas a ver accesos rápidos según tu rol (Administrador, Dirección, Residente, etc.).",
      "Usá el menú lateral: Obras, Tesorería, Clientes, Proveedores y Configuración.",
      "Para trabajar una obra concreta: entrá a Obras y abrí la que corresponda.",
    ],
    tips: [
      "Si no ves un módulo, probablemente tu rol no lo habilita. Pedile a un administrador que revise tu permiso.",
      "Los montos en ARS y USD no se mezclan: siempre se informan por moneda.",
    ],
    shots: [
      {
        src: "/manual/screenshots/01-inicio.png",
        alt: "Pantalla de Inicio del sistema",
        caption: "Inicio — panel principal",
      },
    ],
  },
  {
    id: "obras",
    title: "2. Obras (proyectos)",
    icon: FolderKanban,
    summary:
      "Una obra es el centro de todo: presupuesto, partes, compras y documentos viven dentro de ella.",
    steps: [
      "Andá a Obras en el menú.",
      "Para crear: botón Nueva obra → completá código (único), nombre, ciudad y cliente opcional.",
      "Hacé clic en una obra de la lista para abrir su Resumen.",
      "Desde el Resumen usá los accesos rápidos o el menú de la obra (Presupuesto, Parte diario, etc.).",
      "Eliminar obra (solo Admin/Dirección): en Resumen → Eliminar obra. Solo funciona si la obra no tiene datos cargados (presupuesto, partes, facturas, etc.).",
    ],
    tips: [
      "El código de obra no se puede repetir en la misma empresa.",
      "Si no podés eliminar, el sistema te indica qué datos lo bloquean.",
    ],
    shots: [
      {
        src: "/manual/screenshots/02-obras.png",
        alt: "Listado de obras",
        caption: "Listado de obras",
      },
      {
        src: "/manual/screenshots/03-obra-resumen.png",
        alt: "Resumen de una obra",
        caption: "Resumen de obra — cobros, presupuesto y accesos",
      },
    ],
  },
  {
    id: "clientes-proveedores",
    title: "3. Clientes y proveedores (catálogo)",
    icon: Users,
    summary:
      "Primero cargás el catálogo de la empresa; después los vinculás a cada obra.",
    steps: [
      "Clientes: menú Clientes → alta con nombre, CUIT/tax ID, contacto.",
      "Proveedores: menú Proveedores → misma idea (materiales o servicios).",
      "Dentro de la obra → Cliente y proveedores: asigná el mandante y los proveedores que trabajan esa obra.",
    ],
    shots: [
      {
        src: "/manual/screenshots/18-clientes.png",
        alt: "Catálogo de clientes",
        caption: "Catálogo de clientes",
      },
      {
        src: "/manual/screenshots/19-proveedores.png",
        alt: "Catálogo de proveedores",
        caption: "Catálogo de proveedores",
      },
      {
        src: "/manual/screenshots/04-stakeholders.png",
        alt: "Cliente y proveedores de la obra",
        caption: "Vinculación a la obra",
      },
    ],
  },
  {
    id: "presupuesto",
    title: "4. Presupuesto",
    icon: Wallet,
    summary:
      "El presupuesto define las partidas. El avance certificado y los costos/ingresos reales se contrastan contra esas partidas.",
    steps: [
      "Obra → Presupuesto.",
      "Creá el presupuesto base y cargá partidas (código, descripción, cantidad, unidad, costo unitario).",
      "Cuando esté listo: Aprobar. Luego podés Cerrar (bloquea ediciones).",
      "Si hay una Orden de Cambio aprobada, el estado puede pasar a Revisado y los montos de partida se actualizan.",
    ],
    tips: [
      "Sin partidas no vas a poder certificar ni imputar bien recibos/OP a la obra.",
      "Presupuesto cerrado (LOCKED): hay que reabrirlo si necesitás aplicar una ODC.",
    ],
    shots: [
      {
        src: "/manual/screenshots/05-presupuesto.png",
        alt: "Presupuesto de la obra",
        caption: "Presupuesto — partidas y control",
      },
    ],
  },
  {
    id: "certificaciones",
    title: "5. Certificaciones de avance",
    icon: BadgePercent,
    summary:
      "Documento interno de avance por % de partida (no es factura ARCA). Sirve para documentar lo ejecutado en un período.",
    steps: [
      "Obra → Certificaciones → Nueva certificación.",
      "Definí período, retención de garantía (%) y marcá las partidas con el % acumulado del período.",
      "Guardá → Presentar → Aprobar → opcionalmente Marcar liquidada.",
      "Podés rechazar o eliminar borradores según el estado.",
    ],
    tips: [
      "Estados: Borrador → Presentada → Aprobada → Liquidada (o Rechazada).",
      "El neto = bruto − retención.",
    ],
    shots: [
      {
        src: "/manual/screenshots/06-certificaciones.png",
        alt: "Listado de certificaciones",
        caption: "Certificaciones de la obra",
      },
    ],
  },
  {
    id: "odc",
    title: "6. Órdenes de cambio (ODC)",
    icon: FileDiff,
    summary:
      "Registran extras o ajustes contractuales. Al aprobarlas, impactan el presupuesto.",
    steps: [
      "Obra → Órdenes de cambio → Nueva ODC.",
      "Completá título, descripción y líneas de impacto (partida opcional, Δ cantidad, Δ costo, Δ monto).",
      "Queda Pendiente hasta que Dirección/Admin Apruebe o Rechace.",
      "Si se aprueba con partidas vinculadas, el presupuesto se marca Revisado.",
    ],
    shots: [
      {
        src: "/manual/screenshots/07-ordenes-cambio.png",
        alt: "Órdenes de cambio",
        caption: "Órdenes de cambio",
      },
    ],
  },
  {
    id: "cronograma",
    title: "7. Cronograma (Gantt)",
    icon: CalendarRange,
    summary:
      "Planificá tareas e hitos con fechas y dependencias simples.",
    steps: [
      "Obra → Cronograma.",
      "Creá tareas o hitos con fechas de inicio/fin.",
      "Actualizá el estado (no iniciada, en proceso, completada, etc.).",
      "Usá la vista Gantt para ver la secuencia en el tiempo.",
    ],
    shots: [
      {
        src: "/manual/screenshots/08-cronograma.png",
        alt: "Cronograma Gantt",
        caption: "Cronograma",
      },
    ],
  },
  {
    id: "parte-diario",
    title: "8. Parte diario",
    icon: ClipboardList,
    summary:
      "Registro de lo que pasó en obra ese día: personal, clima, máquinas, incidencias y notas libres.",
    steps: [
      "Obra → Parte diario → Nuevo parte.",
      "Completá las secciones del día (podés dejar notas por sección o por fila).",
      "Guardá. Después podés reabrir el parte desde el listado para editarlo.",
    ],
    tips: [
      "Es el módulo pensado para uso en campo (celular o tablet).",
      "Conviene un parte por día de obra.",
    ],
    shots: [
      {
        src: "/manual/screenshots/09-parte-diario.png",
        alt: "Parte diario",
        caption: "Parte diario",
      },
    ],
  },
  {
    id: "punch-list",
    title: "9. Punch List (observaciones)",
    icon: TriangleAlert,
    summary:
      "Lista de pendientes / defectos con foto, prioridad, ubicación y responsable.",
    steps: [
      "Obra → Punch List → Nueva observación.",
      "Cargá título, ubicación, prioridad, responsable, vencimiento y fotos.",
      "Pasá el estado: Pendiente → En proceso → Resuelto (o reabrí si hace falta).",
    ],
    shots: [
      {
        src: "/manual/screenshots/10-punch-list.png",
        alt: "Punch List",
        caption: "Punch List",
      },
    ],
  },
  {
    id: "documentos",
    title: "10. Documentos",
    icon: FileStack,
    summary:
      "Repositorio de planos, contratos, especificaciones y demás archivos de la obra, con versiones.",
    steps: [
      "Obra → Documentos → subir archivo.",
      "Indicá título, tipo (plano, contrato, etc.) y categoría si aplica.",
      "Podés subir una nueva versión del mismo documento cuando cambie el plano.",
    ],
    shots: [
      {
        src: "/manual/screenshots/11-documentos.png",
        alt: "Documentos de la obra",
        caption: "Documentos",
      },
    ],
  },
  {
    id: "compras",
    title: "11. Compras (facturas de proveedor)",
    icon: ShoppingCart,
    summary:
      "Cargá facturas (PDF o foto). El sistema intenta leer datos y líneas; vos confirmás. Al confirmar, ingresa stock al inventario.",
    steps: [
      "Obra → Compras → Nueva factura.",
      "Subí el PDF/imagen, revisá proveedor, montos y líneas (categoría para inventario).",
      "Cuando esté correcto: Confirmar. La factura queda bloqueada y el stock se actualiza.",
    ],
    tips: [
      "Estados: Borrador → Confirmada (o Cancelada).",
      "Si la extracción automática falla, completá las líneas a mano.",
    ],
    shots: [
      {
        src: "/manual/screenshots/12-compras.png",
        alt: "Compras / facturas",
        caption: "Compras",
      },
    ],
  },
  {
    id: "inventario",
    title: "12. Inventario",
    icon: Package,
    summary:
      "Stock agrupado por categoría. Entra al confirmar facturas; sale al registrar consumo del día.",
    steps: [
      "Obra → Inventario para ver existencias.",
      "Registrá consumo del día indicando cantidades usadas (opcionalmente ligado al parte diario).",
      "Controlá que las facturas confirmadas tengan categorías en las líneas.",
    ],
    shots: [
      {
        src: "/manual/screenshots/13-inventario.png",
        alt: "Inventario de la obra",
        caption: "Inventario",
      },
    ],
  },
  {
    id: "tesoreria",
    title: "13. Tesorería: recibos y órdenes de pago",
    icon: Banknote,
    summary:
      "Recibos = cobros. Órdenes de pago = egresos. Al imputar, impactan ingreso/costo real de partidas si las líneas están asociadas.",
    steps: [
      "Menú Tesorería → Recibos u Órdenes de pago.",
      "Creá el documento: fecha, cliente/proveedor o nombre libre, medio de pago, moneda y líneas (obra/partida + monto).",
      "Emitir (pasa a emitido) y luego Imputar (POSTED) para que cuente en el control financiero.",
      "Si el medio es Efectivo, al imputar debe haber una caja diaria abierta en esa moneda: el movimiento entra/sale de la caja automáticamente.",
      "Anular revierte el impacto presupuestario y, si era efectivo, el movimiento de caja.",
    ],
    tips: [
      "Estados: Borrador → Emitido → Imputado · Anulado.",
      "Medios: transferencia, efectivo, cheque (con datos de cheque obligatorios).",
    ],
    shots: [
      {
        src: "/manual/screenshots/14-tesoreria.png",
        alt: "Hub de tesorería",
        caption: "Tesorería — resumen",
      },
      {
        src: "/manual/screenshots/15-recibos.png",
        alt: "Listado de recibos",
        caption: "Recibos",
      },
      {
        src: "/manual/screenshots/16-ordenes-pago.png",
        alt: "Órdenes de pago",
        caption: "Órdenes de pago",
      },
    ],
  },
  {
    id: "caja",
    title: "14. Caja diaria y caja tesorería",
    icon: Building2,
    summary:
      "Caja diaria operativa del día; al cerrar podés transferir el efectivo a la caja de tesorería (caja fuerte).",
    steps: [
      "Tesorería → Caja → Abrir caja del día (fondo inicial y moneda).",
      "Registrá ingresos/egresos/ajustes manuales, o imputá recibos/OP en efectivo.",
      "Al final del día: Cerrar → arqueo (contado) → opcional transferir a tesorería.",
      "Caja tesorería acumula esos cierres y permite depósitos/extracciones de control.",
    ],
    tips: [
      "Solo una caja diaria abierta por moneda a la vez.",
      "Sin caja abierta no se puede imputar un recibo/OP en efectivo.",
    ],
    shots: [
      {
        src: "/manual/screenshots/17-caja.png",
        alt: "Caja diaria",
        caption: "Caja diaria",
      },
    ],
  },
  {
    id: "configuracion",
    title: "15. Configuración de la empresa",
    icon: Settings,
    summary:
      "Datos de la constructora, logo, tema visual y tipo de cambio (p. ej. BNA USD/ARS).",
    steps: [
      "Menú Configuración (Admin/Dirección).",
      "Actualizá razón social, contacto y logo.",
      "Revisá monedas y sincronizá o cargá la cotización USD/ARS cuando haga falta.",
    ],
    shots: [
      {
        src: "/manual/screenshots/20-configuracion.png",
        alt: "Configuración",
        caption: "Configuración",
      },
    ],
  },
  {
    id: "flujo-recomendado",
    title: "16. Flujo recomendado del día a día",
    icon: BookOpen,
    summary:
      "Orden sugerido para no trabarte con dependencias entre módulos.",
    steps: [
      "Una sola vez: Configuración → Clientes y Proveedores → Crear obra → Vincular stakeholders → Cargar presupuesto y aprobarlo.",
      "En obra: Cronograma y Documentos según avance del proyecto.",
      "Cada día de campo: Parte diario + Punch list + Consumo de inventario.",
      "Compras: subir y confirmar facturas (alimenta stock).",
      "Cobros/pagos: Recibos y OP; si hay efectivo, abrí caja primero.",
      "Fin de mes / hitos: Certificaciones y, si hubo extras, Órdenes de cambio.",
      "Cierre de caja diaria → transferencia a tesorería.",
    ],
    tips: [
      "Subcontratas aún está en preparación (pantalla provisional).",
      "Para practicar sin miedo, usá una obra de prueba vacía: se puede eliminar si no tiene datos.",
    ],
    shots: [],
  },
];
