# 005 — App móvil (Expo) y Sorteos

## Qué / Por qué

Versión móvil de la aplicación (**Mis Gastos**) construida con **Expo** (React Native), que
reutiliza el mismo backend de InsForge, e incorpora una sección de **Sorteos** sobre las tablas
nuevas `sorteos`, `pagos` y `push_tokens`.

## Historias de usuario

- **HU-1**: Como propietario, quiero abrir la app en el móvil y acceder a las mismas secciones
  que en la web (Mercadona, Iberdrola, Combustible, Cuenta) desde una portada de botones.
- **HU-2**: Como gestor de sorteos, quiero crear/editar sorteos (`nombre`, `fecha`, `precio`,
  `tipo`, `decimos_totales`).
- **HU-3**: Como gestor, quiero ver los pagos de abonados de un sorteo, marcarlos como
  pagados/pendientes, ajustar cantidad y método de pago, y añadir o borrar pagos.

## Requisitos funcionales

- **FR-001**: La app arranca con una **portada de botones** (mobile-first) con las secciones y el
  saldo de la cuenta (`bank_account_balances`).
- **FR-002**: `SectionMenu` (pills) navega dentro de cada sección.
- **FR-003**: **Mercadona**: resumen (`mercadona_spend_summary`), tickets y detalle, productos
  (`mercadona_products`) y su histórico (`mercadona_product_history`).
- **FR-004**: **Iberdrola**: facturas (`iberdrola_summary` + detalle con líneas y tramos) y
  contratos con totales.
- **FR-005**: **Combustible**: repostajes Waylet (`waylet_summary` + detalle con líneas).
- **FR-006**: **Cuenta**: movimientos (`bank_summary`), saldo, edición de **concepto** y
  **categoría**, vinculación con tickets/facturas/repostajes, y CRUD de categorías.
- **FR-007**: **Sorteos**: listado con recaudación, alta/edición/borrado de sorteos y gestión de
  pagos de abonados.
- **FR-010**: **Abonados**: CRUD (nombre, grupos múltiples `mensual`/`extraordinario`, activo). El
  detalle de un sorteo lista a los abonados de su grupo (tipo `mensual` ↔ `mensual`; tipo
  `especial` ↔ `extraordinario`) y permite darlos de alta en bloque y gestionar sus pagos.
- **FR-011**: Editar sorteos (incluida la **cantidad de décimos para vender**). En el detalle se
  muestra **Décimos para vender / asignados / disponibles**, y un desglose de **Cobros** por método
  (**efectivo** y **bizum**, únicos métodos válidos) con el total cobrado, lo pendiente y la lista
  de abonados agrupada por método (los pagados sin método se listan aparte para revisarlos).
- **FR-012**: Los **resúmenes de Mercadona, Iberdrola, Combustible y Cuenta** (web y móvil) se
  pueden **filtrar por año** (selector con "Todos" + años disponibles), aplicando el rango también
  a las listas de cada sección.
- **FR-013**: El **detalle de un contrato de Iberdrola** (web y móvil) muestra un **desglose por
  años** (año · nº facturas · consumo · €/kWh · importe).
- **FR-014**: **Clasificador de movimientos** (web y móvil): asignar categoría a cada movimiento
  (individual o en bloque), ver las categorías y **vaciarlas para rehacerlas desde cero**, y ver/
  vincular los **tickets, facturas y repostajes archivados** sugeridos por importe/fecha.
- **FR-015**: **Página de vincular** por movimiento (móvil `cuenta/vincular/[id]`, abierta desde el
  clasificador, no popup): categoría **manual** + **sugerencia automática** (`bank_suggest_category`,
  por historial y por palabras clave) y vinculación/búsqueda de tickets y facturas archivadas. En
  web la sugerencia aparece en el editor de `/movimientos/[id]`.
- **FR-008**: **Sin autenticación**: la app accede con la **API key admin** (app personal, no
  publicada); la clave vive en `mobile/.env` (gitignored). No se usa la tabla `push_tokens`
  (sin notificaciones en esta versión).
- **FR-009**: En el detalle de ticket/factura/repostaje se puede **abrir el PDF original dentro de
  la app** (descarga autenticada del bucket privado y render con **PDF.js empaquetado localmente**
  —sin CDN— en un WebView), con opción de compartir/guardar.

## No objetivos

- Publicación en App Store / Play Store.
- Notificaciones push (la tabla `push_tokens` queda para más adelante).
- Pasarela de pago para los sorteos (el pago se marca manualmente).
- Gestión de un catálogo de "abonados" (no existe tabla; se usa el `abonado_id` existente).

## Criterios de aceptación

- **SC-1**: `npx tsc --noEmit` sin errores y `npx expo export --platform android` empaqueta el bundle.
- **SC-2**: Desde la portada se navega a las cinco secciones y de vuelta.
- **SC-3**: Crear un sorteo y un pago actualiza `sorteos`/`pagos` en InsForge y se refleja en la lista.
