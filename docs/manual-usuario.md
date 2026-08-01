# Manual de uso — Buñas / Constructora ERP

Guía completa para usuarios que usan el sistema por primera vez.

> **Versión interactiva en la app:** menú lateral → **Manual** (`/manual`), con las mismas capturas de pantalla reales.

Las imágenes están en `public/manual/screenshots/`. Para regenerarlas (con el servidor en `http://localhost:3000` y al menos una obra):

```bash
npm run manual:screenshots
```

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Alta, planes y suscripción](#2-alta-planes-y-suscripción)
3. [Usuarios y cupos del plan](#3-usuarios-y-cupos-del-plan)
4. [Obras](#4-obras-proyectos)
5. [Clientes y proveedores](#5-clientes-y-proveedores-catálogo)
6. [Presupuesto](#6-presupuesto)
7. [Certificaciones](#7-certificaciones-de-avance)
8. [Órdenes de cambio](#8-órdenes-de-cambio-odc)
9. [Cronograma](#9-cronograma-gantt)
10. [Parte diario](#10-parte-diario)
11. [Punch List](#11-punch-list-observaciones)
12. [Documentos](#12-documentos)
13. [Compras](#13-compras-facturas-de-proveedor)
14. [Inventario](#14-inventario)
15. [Tesorería](#15-tesorería-recibos-op-bancos-y-cheques)
16. [Caja](#16-caja-diaria-y-caja-tesorería)
17. [Turnero](#17-turnero)
18. [Configuración](#18-configuración-de-la-empresa)
19. [Administración](#19-administración)
20. [Flujo recomendado](#20-flujo-recomendado-del-día-a-día)

---

## 1. Primeros pasos

Al entrar ves el **Inicio**. El menú izquierdo concentra lo de la empresa; abajo figuran tu **email** y **Cerrar sesión**.

1. Iniciá sesión (email/contraseña o Google si está habilitado).
2. Si tenés varias empresas: **Cambiar empresa** / **Empresas**.
3. Menú: Obras, Tesorería, Clientes, Proveedores, Configuración, Administración (Admin), Turnero, Manual.
4. Avisos superiores: **días de prueba** (con Ver planes) y **cheques** vencidos/por vencer.

**Tips:** Si no ves un módulo, revisá permisos. La sesión se cierra por inactividad (default 30 min). ARS y USD no se mezclan.

![Inicio](../public/manual/screenshots/01-inicio.png)

---

## 2. Alta, planes y suscripción

1. Registro → si no hay empresa, elegís plan.
2. **Prueba 30 días:** gratis; creás la empresa y entrás. No permite altas de usuarios hasta contratar.
3. **Planes (USD):**
   - Unipersonal — 1 usuario — **59**/mes · **599**/año  
   - Equipo — hasta 5 — **99**/mes · **999**/año  
   - Ilimitado — sin tope — **119**/mes · **1199**/año  
4. Pago: **Mercado Pago** (si está configurado) o **transferencia** USD/ARS con comprobante.
5. **/billing (Suscripción):** estado, plan, vigencia, historial y renovación / upgrade.

**Tips:** La prueba es una sola vez por usuario. Empresas **Exentas** no pagan.

---

## 3. Usuarios y cupos del plan

1. Configuración → Usuarios (o Administración → Alta y permisos).
2. Alta: email, contraseña, rol, módulos; opcional multi-empresa.
3. Roles: Admin, Dirección, Residente, Solo lectura, Proveedor.
4. El plan limita miembros; si está lleno, hay que mejorar el plan.
5. En prueba, **Nuevo usuario** queda bloqueado.

---

## 4. Obras (proyectos)

1. Menú **Obras**.
2. **Nueva obra** → código único, nombre, ciudad, cliente opcional.
3. Abrí el **Resumen** y usá el menú de la obra.
4. **Eliminar obra** (Admin/Dirección): solo sin datos operativos.

![Obras](../public/manual/screenshots/02-obras.png)

![Resumen](../public/manual/screenshots/03-obra-resumen.png)

---

## 5. Clientes y proveedores (catálogo)

1. **Clientes** / **Proveedores** → alta en el catálogo.
2. Obra → **Cliente y proveedores** → vinculá mandante y proveedores.

![Clientes](../public/manual/screenshots/18-clientes.png)

![Proveedores](../public/manual/screenshots/19-proveedores.png)

![Stakeholders](../public/manual/screenshots/04-stakeholders.png)

---

## 6. Presupuesto

1. Obra → **Presupuesto**.
2. Partidas (código, descripción, cantidad, unidad, costo).
3. **Aprobar**; opcionalmente **Cerrar**.
4. Una ODC aprobada puede dejar el presupuesto en **Revisado**.

![Presupuesto](../public/manual/screenshots/05-presupuesto.png)

---

## 7. Certificaciones de avance

Documento interno de avance por % (no es factura ARCA).

1. Obra → **Certificaciones** → Nueva.
2. Período, retención %, partidas con % acumulado.
3. Presentar → Aprobar → Marcar liquidada.

Estados: Borrador → Presentada → Aprobada → Liquidada (o Rechazada).

![Certificaciones](../public/manual/screenshots/06-certificaciones.png)

---

## 8. Órdenes de cambio (ODC)

1. Obra → **Órdenes de cambio** → Nueva.
2. Título, líneas de impacto (Δ cantidad / costo / monto).
3. Dirección/Admin **Aprueba** o **Rechaza**. Al aprobar, impacta partidas.

![ODC](../public/manual/screenshots/07-ordenes-cambio.png)

---

## 9. Cronograma (Gantt)

1. Obra → **Cronograma**.
2. Tareas/hitos con fechas.
3. Actualizá estados y mirá el Gantt.

![Cronograma](../public/manual/screenshots/08-cronograma.png)

---

## 10. Parte diario

1. Obra → **Parte diario** → Nuevo.
2. Personal, clima, máquinas, incidencias y notas.
3. Guardá y reabrí desde el listado si hace falta.

![Parte diario](../public/manual/screenshots/09-parte-diario.png)

---

## 11. Punch List (observaciones)

1. Obra → **Punch List** → Nueva observación (+ foto).
2. Prioridad, ubicación, responsable, vencimiento.
3. Pendiente → En proceso → Resuelto.

![Punch List](../public/manual/screenshots/10-punch-list.png)

---

## 12. Documentos

1. Obra → **Documentos** → subir archivo.
2. Título, tipo y categoría.
3. Nuevas versiones cuando cambie un plano.

![Documentos](../public/manual/screenshots/11-documentos.png)

---

## 13. Compras (facturas de proveedor)

1. Obra → **Compras** → Nueva factura (PDF/foto).
2. Revisá líneas y categorías.
3. **Confirmar** → ingresa stock.

![Compras](../public/manual/screenshots/12-compras.png)

---

## 14. Inventario

1. Obra → **Inventario**.
2. **Consumo del día**.
3. El ingreso viene de facturas confirmadas.

![Inventario](../public/manual/screenshots/13-inventario.png)

---

## 15. Tesorería: recibos, OP, bancos y cheques

- **Recibos** = cobros · **Órdenes de pago** = egresos.

1. Tesorería → Recibos u OP → crear con líneas (obra/partida).
2. Emitir → **Imputar**.
3. Medio **Efectivo** → requiere **caja diaria abierta**.
4. **Cheques:** el banner superior avisa vencidos / por vencer (días configurables en la empresa).

Estados: Borrador → Emitido → Imputado · Anulado.

![Tesorería](../public/manual/screenshots/14-tesoreria.png)

![Recibos](../public/manual/screenshots/15-recibos.png)

![OP](../public/manual/screenshots/16-ordenes-pago.png)

---

## 16. Caja diaria y caja tesorería

1. Tesorería → **Caja** → Abrir caja del día.
2. Movimientos manuales o imputación de recibos/OP en efectivo.
3. Cerrar con arqueo → transferir a caja tesorería.

![Caja](../public/manual/screenshots/17-caja.png)

---

## 17. Turnero

1. Menú **Turnero** (si tenés el módulo): puestos y cola.
2. Vista **operador:** tomar / llamar / atender.
3. **Pantalla pública** (`/turnero/pantalla`) sin login para llamados.

---

## 18. Configuración de la empresa

1. Menú **Configuración** (Admin/Dirección).
2. Datos, logo, tema, monedas, bancos, cotización USD/ARS.
3. Días de aviso de cheques y **minutos de inactividad** de sesión (5–480).
4. Usuarios y permisos (sección 3).

![Configuración](../public/manual/screenshots/20-configuracion.png)

---

## 19. Administración

1. Menú **Administración** (rol Admin).
2. **Usuarios por empresa:** miembros y presencia en línea de las empresas que administrás.
3. **Alta y permisos** / **Empresas:** altas y perfiles.
4. **Pagos:** si tu empresa tiene habilitada la revisión, aprobá o rechazá transferencias SaaS pendientes.

**Tip:** para gestionar usuarios de otra empresa, cambiá de empresa y volvé a Administración.

---

## 20. Flujo recomendado del día a día

1. **Una vez:** registro/plan → Configuración → Clientes/Proveedores → Obra → Stakeholders → Presupuesto aprobado.
2. **Proyecto:** Cronograma y Documentos.
3. **Campo:** Parte diario + Punch list + Consumo.
4. **Compras:** confirmar facturas.
5. **Cobros/pagos:** Recibos y OP; caja si hay efectivo; cheques.
6. **Cierre de período:** Certificaciones y ODC.
7. **Fin del día de caja:** cerrar y transferir a tesorería.
8. Si estás en **prueba:** contratá plan antes de vencer y antes de sumar usuarios.

---

## Roles (resumen)

| Rol | Suele poder |
|-----|-------------|
| Admin / Director | Todo + obras + ODC + configuración + (Admin) panel Administración |
| Residente | Operación de obra, compras, tesorería/caja |
| Viewer | Lectura de módulos abiertos |
| Provider | Orientado a proveedores / subcontratas |
