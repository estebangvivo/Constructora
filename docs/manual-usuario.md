# Manual de uso — Constructora ERP

Guía completa para usuarios que usan el sistema por primera vez.

> **Versión interactiva en la app:** menú lateral → **Manual** (`/manual`), con las mismas capturas de pantalla reales.

Las imágenes están en `public/manual/screenshots/`. Para regenerarlas (con el servidor en `http://localhost:3000` y al menos una obra):

```bash
npm run manual:screenshots
```

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Obras](#2-obras-proyectos)
3. [Clientes y proveedores](#3-clientes-y-proveedores-catálogo)
4. [Presupuesto](#4-presupuesto)
5. [Certificaciones](#5-certificaciones-de-avance)
6. [Órdenes de cambio](#6-órdenes-de-cambio-odc)
7. [Cronograma](#7-cronograma-gantt)
8. [Parte diario](#8-parte-diario)
9. [Punch List](#9-punch-list-observaciones)
10. [Documentos](#10-documentos)
11. [Compras](#11-compras-facturas-de-proveedor)
12. [Inventario](#12-inventario)
13. [Tesorería](#13-tesorería-recibos-y-órdenes-de-pago)
14. [Caja](#14-caja-diaria-y-caja-tesorería)
15. [Configuración](#15-configuración-de-la-empresa)
16. [Flujo recomendado](#16-flujo-recomendado-del-día-a-día)

---

## 1. Primeros pasos

Al entrar ves el **Inicio**. El menú izquierdo concentra lo de la empresa; cada obra tiene su propio menú interno.

1. Abrí el sistema e iniciá sesión.
2. En Inicio vas a ver accesos según tu rol.
3. Usá el menú: Obras, Tesorería, Clientes, Proveedores, Configuración, Manual.
4. Para trabajar una obra: entrá a **Obras** y abrila.

**Tips:** Si no ves un módulo, tu rol no lo habilita. ARS y USD no se mezclan.

![Inicio](../public/manual/screenshots/01-inicio.png)

---

## 2. Obras (proyectos)

Una obra es el centro de todo.

1. Menú **Obras**.
2. **Nueva obra** → código único, nombre, ciudad, cliente opcional.
3. Abrí una obra para ver el **Resumen**.
4. Desde ahí usá accesos rápidos o el menú de la obra.
5. **Eliminar obra** (Admin/Dirección): solo si no tiene datos operativos.

![Obras](../public/manual/screenshots/02-obras.png)

![Resumen](../public/manual/screenshots/03-obra-resumen.png)

---

## 3. Clientes y proveedores (catálogo)

1. **Clientes** / **Proveedores** en el menú → alta en el catálogo.
2. Dentro de la obra → **Cliente y proveedores** → asigná mandante y proveedores.

![Clientes](../public/manual/screenshots/18-clientes.png)

![Proveedores](../public/manual/screenshots/19-proveedores.png)

![Stakeholders](../public/manual/screenshots/04-stakeholders.png)

---

## 4. Presupuesto

1. Obra → **Presupuesto**.
2. Creá partidas (código, descripción, cantidad, unidad, costo).
3. **Aprobar**; opcionalmente **Cerrar** (bloquea ediciones).
4. Una ODC aprobada puede dejar el presupuesto en **Revisado**.

![Presupuesto](../public/manual/screenshots/05-presupuesto.png)

---

## 5. Certificaciones de avance

Documento interno de avance por % (no es factura ARCA).

1. Obra → **Certificaciones** → Nueva.
2. Período, retención %, partidas con % acumulado.
3. Presentar → Aprobar → Marcar liquidada.

Estados: Borrador → Presentada → Aprobada → Liquidada (o Rechazada).

![Certificaciones](../public/manual/screenshots/06-certificaciones.png)

---

## 6. Órdenes de cambio (ODC)

1. Obra → **Órdenes de cambio** → Nueva.
2. Título, líneas de impacto (Δ cantidad / costo / monto).
3. Dirección/Admin **Aprueba** o **Rechaza**. Al aprobar, impacta partidas.

![ODC](../public/manual/screenshots/07-ordenes-cambio.png)

---

## 7. Cronograma (Gantt)

1. Obra → **Cronograma**.
2. Creá tareas/hitos con fechas.
3. Actualizá estados y mirá la secuencia en el Gantt.

![Cronograma](../public/manual/screenshots/08-cronograma.png)

---

## 8. Parte diario

1. Obra → **Parte diario** → Nuevo.
2. Completá personal, clima, máquinas, incidencias y notas.
3. Guardá y reabrí desde el listado si hace falta.

![Parte diario](../public/manual/screenshots/09-parte-diario.png)

---

## 9. Punch List (observaciones)

1. Obra → **Punch List** → Nueva observación (+ foto).
2. Prioridad, ubicación, responsable, vencimiento.
3. Pendiente → En proceso → Resuelto.

![Punch List](../public/manual/screenshots/10-punch-list.png)

---

## 10. Documentos

1. Obra → **Documentos** → subir archivo.
2. Título, tipo y categoría.
3. Subí nuevas versiones cuando cambie un plano.

![Documentos](../public/manual/screenshots/11-documentos.png)

---

## 11. Compras (facturas de proveedor)

1. Obra → **Compras** → Nueva factura (PDF/foto).
2. Revisá líneas y categorías.
3. **Confirmar** → ingresa stock al inventario.

![Compras](../public/manual/screenshots/12-compras.png)

---

## 12. Inventario

1. Obra → **Inventario** (stock por categoría).
2. Registrá **consumo del día**.
3. El ingreso viene de facturas confirmadas.

![Inventario](../public/manual/screenshots/13-inventario.png)

---

## 13. Tesorería: recibos y órdenes de pago

- **Recibos** = cobros · **Órdenes de pago** = egresos.

1. Tesorería → Recibos u OP → crear con líneas (obra/partida).
2. Emitir → **Imputar** (impacta ingreso/costo real).
3. Si el medio es **Efectivo**, debe haber **caja diaria abierta** en esa moneda.

Estados: Borrador → Emitido → Imputado · Anulado.

![Tesorería](../public/manual/screenshots/14-tesoreria.png)

![Recibos](../public/manual/screenshots/15-recibos.png)

![OP](../public/manual/screenshots/16-ordenes-pago.png)

---

## 14. Caja diaria y caja tesorería

1. Tesorería → **Caja** → Abrir caja del día.
2. Movimientos manuales o imputación de recibos/OP en efectivo.
3. Cerrar con arqueo → transferir a caja tesorería.

![Caja](../public/manual/screenshots/17-caja.png)

---

## 15. Configuración de la empresa

1. Menú **Configuración** (Admin/Dirección).
2. Datos, logo, tema.
3. Cotización USD/ARS (BNA u carga manual).

![Configuración](../public/manual/screenshots/20-configuracion.png)

---

## 16. Flujo recomendado del día a día

1. **Una vez:** Configuración → Clientes/Proveedores → Obra → Stakeholders → Presupuesto aprobado.
2. **Proyecto:** Cronograma y Documentos.
3. **Cada día de campo:** Parte diario + Punch list + Consumo de inventario.
4. **Compras:** confirmar facturas (alimentan stock).
5. **Cobros/pagos:** Recibos y OP; si hay efectivo, abrí caja primero.
6. **Cierre de período:** Certificaciones y ODC si hubo extras.
7. **Fin del día de caja:** cerrar y transferir a tesorería.

**Nota:** Subcontratas todavía es una pantalla provisional.

---

## Roles (resumen)

| Rol | Suele poder |
|-----|-------------|
| Admin / Director | Todo + crear/eliminar obras + aprobar ODC + configuración |
| Residente | Operación de obra, compras, tesorería/caja |
| Viewer | Lectura de módulos abiertos |
| Provider | Pensado para subcontratas (módulo aún en preparación) |
