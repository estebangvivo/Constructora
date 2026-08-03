import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Banknote,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardList,
  CreditCard,
  FileDiff,
  FileStack,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Ticket,
  TriangleAlert,
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
  title: "Manual de uso · SimpleObra",
  subtitle:
    "Guía de SimpleObra: alta y planes SaaS, obras, campo, compras, inventario, tesorería, turnero y administración.",
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "primeros-pasos",
    title: "1. Primeros pasos",
    icon: LayoutDashboard,
    summary:
      "Al entrar vas al Inicio. El menú izquierdo concentra lo de la empresa; abajo ves tu email y Cerrar sesión. Cada obra tiene su propio menú interno.",
    steps: [
      "Abrí el sistema e iniciá sesión con email y contraseña (o Google si está habilitado).",
      "Si tu usuario pertenece a varias empresas, podés cambiar con Cambiar empresa / Empresas en el menú.",
      "En Inicio ves el resumen y accesos según tu rol y módulos habilitados.",
      "Usá el menú: Obras, Tesorería, Clientes, Proveedores, Configuración, Administración (si sos Admin), Turnero y Manual.",
      "Si estás en prueba gratis, un aviso arriba indica los días que quedan y el botón Ver planes.",
      "Si hay cheques en cartera vencidos o por vencer, verás otro aviso similar con acceso a Cheques.",
    ],
    tips: [
      "Si no ves un módulo, tu rol o tus permisos no lo habilitan: pedile a un Admin que revise Usuarios.",
      "La sesión se cierra sola tras un tiempo sin actividad (configurable por empresa, por defecto 30 minutos).",
      "ARS y USD no se mezclan: siempre se informan por moneda.",
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
    id: "planes-suscripcion",
    title: "2. Alta, planes y suscripción",
    icon: CreditCard,
    summary:
      "Empresas nuevas eligen un plan (o prueba gratis). Al vencer el acceso, hay que renovar en Suscripción.",
    steps: [
      "Registro: creá tu cuenta en Sign up (email/contraseña o Google si está disponible).",
      "Si todavía no tenés empresa, el sistema te lleva a elegir plan.",
      "Prueba 30 días: gratis, sin pago. Creás la empresa y entrás al sistema de inmediato.",
      "Planes de pago (USD): Unipersonal (1 usuario) 59/mes o 599/año · Equipo (hasta 5) 99/mes o 999/año · Ilimitado 119/mes o 1199/año.",
      "Pago: Mercado Pago (si está habilitado) o transferencia en USD/ARS con comprobante (queda pendiente de aprobación).",
      "Durante la prueba no podés dar de alta más usuarios: tenés que contratar un plan.",
      "Menú Suscripción (/billing): ves estado, plan, vigencia e historial; si venció (o querés pasar de prueba a pago), elegís nivel y periodo.",
    ],
    tips: [
      "La prueba gratis es una sola vez por usuario.",
      "Empresas internas marcadas como Exentas no pagan ni ven el bloqueo de suscripción.",
      "El aviso de días de prueba está arriba de la pantalla mientras la prueba esté activa.",
    ],
    shots: [],
  },
  {
    id: "usuarios-cupos",
    title: "3. Usuarios y cupos del plan",
    icon: Users,
    summary:
      "Cada plan limita cuántas personas pueden pertenecer a la empresa. Los Admin/Dirección gestionan altas y permisos.",
    steps: [
      "Configuración → Usuarios (o Administración → Alta y permisos).",
      "Nuevo usuario: email, contraseña (si es nuevo), rol y módulos. Podés asignarlo a varias empresas que administres.",
      "Roles habituales: Admin, Dirección, Residente, Solo lectura, Proveedor.",
      "Si el plan Unipersonal o Equipo ya está lleno, el sistema no deja sumar más miembros: hay que mejorar de plan en Suscripción.",
      "En prueba gratis el botón Nuevo usuario queda bloqueado hasta contratar un plan.",
    ],
    tips: [
      "Vaciar módulos usa los defaults del rol; Admin suele ver todo.",
      "No te quites el rol Admin si sos el único administrador de la empresa.",
    ],
    shots: [
      {
        src: "/manual/screenshots/20-configuracion.png",
        alt: "Configuración y usuarios",
        caption: "Configuración — también incluye usuarios",
      },
    ],
  },
  {
    id: "obras",
    title: "4. Obras (proyectos)",
    icon: FolderKanban,
    summary:
      "Una obra es el centro de todo: presupuesto, partes, compras y documentos viven dentro de ella.",
    steps: [
      "Andá a Obras en el menú.",
      "Para crear: botón Nueva obra → completá código (único), nombre, ciudad y cliente opcional.",
      "Hacé clic en una obra de la lista para abrir su Resumen.",
      "Desde el Resumen usá los accesos rápidos o el menú de la obra (Presupuesto, Parte diario, etc.).",
      "Eliminar obra (solo Admin/Dirección): en Resumen → Eliminar obra. Solo funciona si la obra no tiene datos cargados.",
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
    title: "5. Clientes y proveedores (catálogo)",
    icon: Handshake,
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
    title: "6. Presupuesto",
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
    title: "7. Certificaciones de avance",
    icon: BadgePercent,
    summary:
      "Documento interno de avance por % de partida (no es factura ARCA). Sirve para documentar lo ejecutado en un período.",
    steps: [
      "Obra → Certificaciones → Nueva certificación.",
      "Definí período, retención de garantía (%) y marcá las partidas con el % acumulado del período.",
      "Guardá → Presentar → opcionalmente Marcar liquidada (y emitir OP / reporte).",
      "Podés rechazar o eliminar borradores según el estado.",
    ],
    tips: [
      "Estados: Borrador → Presentada → Liquidada (o Rechazada).",
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
    title: "8. Órdenes de cambio (ODC)",
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
    title: "9. Cronograma (Gantt)",
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
    title: "10. Parte diario",
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
    title: "11. Punch List (observaciones)",
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
    title: "12. Documentos",
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
    title: "13. Compras (facturas de proveedor)",
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
    title: "14. Inventario",
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
    title: "15. Tesorería: recibos, OP, bancos y cheques",
    icon: Banknote,
    summary:
      "Recibos = cobros. Órdenes de pago = egresos. También bancos, depósitos y cheques (propios y de terceros).",
    steps: [
      "Menú Tesorería → Recibos u Órdenes de pago.",
      "Creá el documento: fecha, cliente/proveedor o nombre libre, medio de pago, moneda y líneas (obra/partida + monto).",
      "Emitir y luego Imputar (POSTED) para que cuente en el control financiero.",
      "Si el medio es Efectivo, al imputar debe haber una caja diaria abierta en esa moneda.",
      "Cheques: cargá datos de vencimiento; el aviso superior avisa vencidos / por vencer según los días configurados en la empresa.",
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
    title: "16. Caja diaria y caja tesorería",
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
    id: "turnero",
    title: "17. Turnero",
    icon: Ticket,
    summary:
      "Gestión de turnos por puesto (operador) y pantalla pública para llamar turnos.",
    steps: [
      "Menú Turnero (si tu rol tiene el módulo): puestos, cola y operación del día.",
      "Operador: tomá / llamá / atendé turnos desde la vista de operador.",
      "Pantalla pública (/turnero/pantalla): muestra llamados sin login (configurada por empresa).",
    ],
    tips: [
      "Los usuarios pueden tener un puesto de turnero asignado en su ficha.",
    ],
    shots: [],
  },
  {
    id: "configuracion",
    title: "18. Configuración de la empresa",
    icon: Settings,
    summary:
      "Datos de la constructora, logo, tema, monedas, bancos, cotización, usuarios y tiempo de sesión inactiva.",
    steps: [
      "Menú Configuración (Admin/Dirección).",
      "Actualizá razón social, contacto, logo y tema visual.",
      "Revisá monedas habilitadas y cotización USD/ARS (BNA o carga manual).",
      "Configurá cuentas bancarias si operás tesorería bancaria.",
      "Aviso de cheques por vencer: cantidad de días de anticipación.",
      "Minutos sin actividad antes de cerrar sesión (entre 5 y 480).",
      "Gestioná usuarios y permisos (ver sección 3).",
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
    id: "administracion",
    title: "19. Administración",
    icon: Shield,
    summary:
      "Panel para Admin de la empresa: usuarios por empresa, altas, perfiles de empresas que administrás y revisión de pagos por transferencia cuando corresponda.",
    steps: [
      "Menú Administración (rol Admin).",
      "Usuarios por empresa: miembros, roles y presencia en línea de las empresas que administrás.",
      "Alta y permisos: crear/editar usuarios de la empresa activa.",
      "Empresas: crear una empresa nueva o editar el perfil de las que administrás.",
      "Pagos: si tu empresa tiene habilitada la revisión de transferencias SaaS, aprobá o rechazá comprobantes pendientes.",
    ],
    tips: [
      "El email del usuario aparece arriba de Cerrar sesión: así confirmás con qué cuenta estás.",
      "Para trabajar usuarios de otra empresa, cambiá de empresa y volvé a Administración.",
    ],
    shots: [],
  },
  {
    id: "flujo-recomendado",
    title: "20. Flujo recomendado del día a día",
    icon: BookOpen,
    summary:
      "Orden sugerido para no trabarte con dependencias entre módulos.",
    steps: [
      "Una sola vez: registrarte / plan → Configuración → Clientes y Proveedores → Crear obra → Vincular stakeholders → Cargar presupuesto y aprobarlo.",
      "En obra: Cronograma y Documentos según avance del proyecto.",
      "Cada día de campo: Parte diario + Punch list + Consumo de inventario.",
      "Compras: subir y confirmar facturas (alimenta stock).",
      "Cobros/pagos: Recibos y OP; si hay efectivo, abrí caja primero. Revisá cheques por vencer.",
      "Fin de mes / hitos: Certificaciones y, si hubo extras, Órdenes de cambio.",
      "Cierre de caja diaria → transferencia a tesorería.",
      "Si estás en prueba: contratá un plan antes de vencer y antes de sumar usuarios.",
    ],
    tips: [
      "Subcontratas aún puede estar en preparación según tu versión.",
      "Para practicar, usá una obra de prueba vacía: se puede eliminar si no tiene datos.",
    ],
    shots: [],
  },
];
