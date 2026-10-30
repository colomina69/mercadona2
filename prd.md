# PRD — Mis Gastos (`insforge`)

> Documento de requisitos de producto. Describe **qué** se construye, **para quién** y **por qué**,
> además del estado actual. Para el detalle técnico de cada dominio ver `specs/` y para la bitácora
> de cambios `MEMORY.md`.

- **Versión:** 1.0
- **Fecha:** 2026-10-15
- **Estado:** producto en uso (web + Android), en evolución
- **Idioma:** español

---

## 1. Resumen ejecutivo

**Mis Gastos** es una aplicación **personal** (un único propietario) para **centralizar, clasificar y
analizar los gastos domésticos** a partir de documentos que llegan por email, extractos bancarios y
fotos de tickets.

Automatiza la ingesta con **n8n** (Gmail, webhooks y agentes de IA), guarda todo en **InsForge**
(PostgreSQL + Storage + RLS) y ofrece dos clientes:

- **Web** (Next.js 14): análisis, gráficas y gestión detallada.
- **Móvil Android** (Expo/React Native): consulta rápida, clasificación y captura con cámara.

La propuesta de valor es **cero trabajo manual de transcripción**: los datos se extraen solos y el
usuario solo revisa, clasifica y vincula.

---

## 2. Problema y oportunidad

### Problema
El gasto doméstico está disperso en canales distintos (tickets de supermercado, facturas de luz,
repostajes, facturas de proveedores y cargos bancarios). Reconciliar cada cargo con su justificante y
clasificarlo es tedioso y propenso a errores; los datos acaban sin categorizar y sin trazabilidad.

### Oportunidad
- Automatizar la captura y la extracción (incluida **visión artificial** para fotos).
- Unificar **movimiento bancario ↔ justificante** en un modelo de vínculos genérico.
- Convertir la clasificación en un flujo guiado con **sugerencias** y una regla de **completitud**
  (categoría + documento), sin trabajo manual de transcripción.

### Objetivos del producto
1. **Captura automática** de documentos desde email y foto, sin introducir datos a mano.
2. **Trazabilidad**: cada cargo bancario debe poder enlazarse con su ticket/factura.
3. **Clasificación sin fricción**: categorías jerárquicas, sugerencias y alta inline.
4. **Visibilidad**: resúmenes, gráficas y estado de completitud ("pendientes").
5. **Multiplataforma**: web para análisis y Android para uso diario.

### No objetivos (fuera de alcance)
- Multi‑usuario/organizaciones, permisos granulares y onboarding de terceros.
- Pasarelas de pago reales (los pagos de sorteos se registran manualmente).
- App iOS publicada (el stack lo permite, pero no es objetivo actual).
- Conexión directa a la banca por scraping (solo Enable Banking PSD2 AIS ya integrado).

---

## 3. Usuarios y casos de uso

### Usuario principal (único)
Persona que gestiona las finanzas del hogar, con varios correos/bancos y varios comercios. Usa el
móvil a diario y la web para análisis. Asume el rol de **propietario** de todos los datos.

### Casos de uso clave
| # | Caso de uso | Canal |
|---|---|---|
| CU-1 | Ver el gasto de Mercadona por mes, tienda y producto | Web/Móvil |
| CU-2 | Consultar el desglose de una factura de la luz y la evolución de precios | Web/Móvil |
| CU-3 | Revisar repostajes y su coste €/L | Web/Móvil |
| CU-4 | Fotografiar un ticket y que la IA rellene cabecera y líneas | Web/Móvil |
| CU-5 | Clasificar un movimiento con categoría/subcategoría y vincular su justificante | Web/Móvil |
| CU-6 | Ver qué movimientos están incompletos y resolverlos | Web/Móvil |
| CU-7 | Revisar facturas de proveedor y su documento de responsabilidad | Web/Móvil |
| CU-8 | Gestionar sorteos, abonados y pagos (efectivo/Bizum) | Móvil |

---

## 4. Alcance funcional (módulos)

Leyenda de estado: ✅ implementado · 🟡 parcial · ⬜ previsto.

### 4.1 Autenticación y acceso
- ✅ **Web**: email/contraseña con InsForge Auth; `middleware` protege el área privada y redirige a
  `/login`. Sesión por cookies; cliente servidor y cliente navegador.
- ✅ **Móvil**: acceso con **cliente admin** (sin login). Decisión: app personal no publicada en
  tiendas; evita la fricción de sesión. La clave vive solo en `mobile/.env` (gitignored).
- ✅ RLS por propietario en todas las tablas de negocio; buckets privados con políticas de lectura.

### 4.2 Tickets de Mercadona
- ✅ Ingesta por email (n8n + Gmail): PDF → parser → RPC idempotente (`message_id`) → bucket privado.
- ✅ Tickets, productos, alias de productos y líneas.
- ✅ Resumen de gasto con filtros por año/rango, gráficas (mensual, por tienda, top productos).
- ✅ Detalle de ticket y de producto (historial/precio).

### 4.3 Facturas y contratos de Iberdrola
- ✅ Ingesta por email; parser (cabecera + líneas por fórmulas + consumo por tramos) validado.
- ✅ Comparativa de contratos, evolución de **€/kWh** y **€/kW·día**.
- ✅ Detalle de factura con desglose, tramos y PDF original.

### 4.4 Combustible (Waylet / Repsol)
- ✅ Ingesta por email cuyo ticket llega como **enlace** (no adjunto): extraer URL → descargar PDF →
  parsear → upsert → subir PDF.
- ✅ Totales, gráficas de gasto y €/L, filtros; detalle con líneas y PDF.

### 4.5 Proveedores
- ✅ Ingesta de facturas de proveedor (Transportes Albero) por email + backfill.
- ✅ Datos de factura, líneas y **documento de responsabilidad** (PDF/URL).
- ✅ Resumen por proveedor.

### 4.6 Tickets por foto (captura con IA)
- ✅ Subida de foto desde web y móvil (cámara/galería) a un webhook de n8n con token.
- ✅ **Agente de visión** (`deepseek/deepseek-v4.1-flash` vía OpenRouter) extrae: tienda, nº ticket,
  fecha, subtotal, total, transcripción y **líneas de producto** (cantidad, unidad, precio, importe).
- ✅ Creación atómica de ticket + líneas; imagen en bucket `receipts`.
- ✅ Revisión/edición manual (cabecera y líneas), estado `pendiente`/`revisado`.
- ✅ **Categoría por línea** con catálogo propio independiente (`photo_ticket_categories`).
- ✅ Visor de la **foto original** (overlay web / pantalla móvil) y compartir/guardar.
- ✅ La app **ya no hace OCR**; la extracción es 100% del modelo de visión (funciona en Expo Go).

### 4.7 Cuenta y banca
- ✅ Ingesta de movimientos por **extracto TXT** (webhook + token) y por **Enable Banking (PSD2 AIS)**
  desde Banco Sabadell. Deduplicación por `dedup_hash`.
- ✅ Saldos por cuenta (instantáneas diarias).
- ✅ Resumen, gráficas, filtros por año y búsqueda; detalle de movimiento.
- ✅ **Categorías jerárquicas**: categoría → subcategoría (2 niveles, herencia de gasto/ingreso).
- ✅ **Clasificación**: individual y masiva; **creación inline** de categorías/subcategorías.
- ✅ **Sugerencia de categoría** por historial y por comercio.
- ✅ **Vínculos genéricos** movimiento ↔ {ticket Mercadona, factura Iberdrola, repostaje Waylet,
  factura de proveedor, ticket por foto} (muchos‑a‑muchos, con validación de existencia).
- ✅ **Regla de completitud**: cada movimiento debe tener categoría y al menos un vínculo; se
  **avisa** (no se bloquea) en la vista **Pendientes** y en la portada. Excepción
  **"sin documento (no aplica)"** (nómina, comisiones…).
- ✅ **Guardado explícito** del movimiento (concepto, categoría, documento) y guardado automático de
  la clasificación al vincular/desvincular.

### 4.8 Sorteos (móvil)
- ✅ Gestión de sorteos (`mensual`/`especial`), abonados (grupos) y pagos (`pendiente`/`pagado`,
  efectivo/Bizum). Sin pasarela de pago.
- ✅ Registro de `push_tokens` (base para notificaciones).

### 4.9 Navegación y experiencia
- ✅ Web: portada de accesos, navegación contextual por sección (pills), diseño mobile‑first,
  accesibilidad AA (Lighthouse 100 en `/login`).
- ✅ Móvil: portada tipo hub con botones grandes, menús de sección, refresco al volver a las listas.
- ✅ Formato español (fechas, moneda `es-ES`, decimales con coma).

---

## 5. Flujos principales

### 5.1 Alta automática de documentos (email)
1. Llega un correo a la cuenta configurada.
2. n8n (trigger Gmail) descarga el PDF/enlace.
3. Parser específico → RPC `*_upsert_*` (idempotente por `message_id`/`invoice_number`).
4. Se sube el original al bucket privado correspondiente.
5. La app muestra el documento en su sección.

### 5.2 Ticket por foto con IA
1. El usuario hace/selecciona una foto (web o móvil) y la envía al webhook.
2. n8n valida el token, sube la imagen a `receipts` y construye una **data URL**.
3. El agente de visión devuelve JSON (cabecera + líneas).
4. `Parse AI` normaliza números/fechas y `photo_ticket_create` inserta ticket + líneas.
5. El usuario revisa, asigna categoría por línea y vincula con un movimiento.

### 5.3 Clasificar y completar movimientos
1. Entrar en **Pendientes** (o **Clasificar**).
2. Elegir movimiento → asignar categoría/subcategoría (o crear una al vuelo).
3. Vincular con el ticket/factura correcto (sugerencias por importe ±días o búsqueda).
4. Si no procede documento → marcar **"sin documento (no aplica)"**.
5. Guardar; el movimiento desaparece de Pendientes.

---

## 6. Requisitos funcionales

### RF — Tickets por foto
- **RF-01** Subir una imagen (JPG/PNG) desde web y Android.
- **RF-02** Extraer automáticamente tienda, nº ticket, fecha, subtotal, total y líneas.
- **RF-03** Permitir edición manual de todos los campos y de las líneas.
- **RF-04** Asignar una categoría de producto a cada línea (catálogo propio, alta inline).
- **RF-05** Ver la imagen original y compartirla/guardarla.
- **RF-06** Crear el ticket con sus líneas en una sola operación.

### RF — Cuenta y clasificación
- **RF-10** Listar movimientos con filtros por año, cuenta y búsqueda.
- **RF-11** Crear/renombrar/eliminar categorías y **subcategorías** (2 niveles).
- **RF-12** Asignar categoría a un movimiento (individual y masiva).
- **RF-13** Crear categorías/subcategorías **sin salir** de la clasificación.
- **RF-14** Vincular/desvincular cualquier justificante soportado.
- **RF-15** Sugerir categoría por historial/comercio.
- **RF-16** Identificar movimientos **pendientes** (sin categoría o sin documento).
- **RF-17** Marcar **"sin documento (no aplica)"**.
- **RF-18** Guardar el movimiento (concepto, categoría, documento) de forma explícita.

### RF — Ingesta y análisis
- **RF-20** Ingesta idempotente de Mercadona, Iberdrola, Waylet y proveedores por email.
- **RF-21** Ingesta de movimientos por extracto TXT y PSD2.
- **RF-22** Resúmenes y gráficas por dominio con filtros temporales.

### RF — Móvil
- **RF-30** Paridad funcional de consulta y clasificación con la web.
- **RF-31** Cámara/galería para tickets por foto.
- **RF-32** Visor de PDF e imágenes con autenticación.
- **RF-33** Refresco de listas al volver a la pantalla.

---

## 7. Requisitos no funcionales

- **RNF-01 Seguridad**: RLS por `auth.uid()`; buckets privados; columnas financieras inmutables
  (solo `concept`, `category_id`, `document_na` editables); secretos fuera del repo
  (`.env.local`, `n8n/.env.local`, `.insforge/project.json`).
- **RNF-02 Idempotencia**: claves naturales (`message_id`, `invoice_number`, `dedup_hash`) con
  `ON CONFLICT`; reimportar no duplica ni pisa ediciones.
- **RNF-03 Datos crudos inmutables**: `raw_text`/`raw_line` y los importes de origen no se sobrescriben.
- **RNF-04 Rendimiento**: Server Components por defecto, consultas con `limit`, agregaciones en RPC.
- **RNF-05 Accesibilidad**: contraste AA, áreas táctiles ≥ 40 px, foco visible, `aria-current`.
- **RNF-06 Responsive**: mobile‑first; tablas → tarjetas en pantallas pequeñas.
- **RNF-07 Localización**: español, `es-ES`, zona horaria de negocio en `date`.
- **RNF-08 Mantenibilidad**: migraciones versionadas, RPCs con `GRANT`, documentación en `specs/` y
  bitácora en `MEMORY.md`.
- **RNF-09 Portabilidad**: build Android local (APK) y ejecución en Expo Go para desarrollo.

---

## 8. Arquitectura y stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 14.2 (App Router, React 18) + Tailwind 3.4 |
| Móvil | Expo SDK 58 (React Native 0.88) + Expo Router + TypeScript |
| Backend | InsForge (PostgreSQL/PostgREST, Storage, Auth) |
| Automatización | n8n (Gmail, webhooks, parsers, IA) |
| IA | OpenRouter · `deepseek/deepseek-v4.1-flash` (visión) |
| Banca | Enable Banking (PSD2 AIS) + extractos TXT |
| Hosting | Vercel (`insforge-mu.vercel.app`); backend en Dokploy |

**Principios**: InsForge como única fuente de verdad; SDK para la app y CLI/migraciones para
infraestructura; secretos fuera del repositorio; UI accesible.

---

## 9. Modelo de datos (resumen)

| Dominio | Tablas principales |
|---|---|
| Mercadona | `mercadona_tickets`, `mercadona_ticket_items`, `mercadona_products`, `mercadona_product_aliases`, `mercadona_lines` |
| Banca | `bank_transactions`, `bank_categories` (con `parent_id`), `bank_transaction_links`, `bank_account_balances` |
| Iberdrola | `iberdrola_contracts`, `iberdrola_invoices`, `iberdrola_invoice_lines`, `iberdrola_invoice_consumption` |
| Combustible | `waylet_tickets`, `waylet_ticket_lines` |
| Proveedores | `supplier_invoices`, `supplier_invoice_lines` |
| Fotos | `photo_tickets`, `photo_ticket_lines`, `photo_ticket_categories` |
| Sorteos | `sorteos`, `abonados`, `pagos`, `push_tokens` |

**Vínculos**: `bank_transaction_links(target_type ∈ {ticket, invoice, waylet, supplier, photo_ticket})`
con trigger de validación de existencia.

**Buckets privados**: `mercadona`, `bank-statements`, `iberdrola`, `waylet`, `suppliers`, `receipts`.

---

## 10. Integraciones

| Integración | Uso | Notas |
|---|---|---|
| Gmail (n8n) | Ingesta de tickets/facturas | Credencial OAuth `Gmail account` |
| InsForge | Datos, storage, auth | API base `https://insforge.benicolo.com` |
| n8n | Automatizaciones | `https://n8n.benicolo.com`; despliegue con `scripts/n8n-build.js` |
| OpenRouter | Extracción por visión | Key en `n8n/.env.local`, inyectada en build |
| Enable Banking | Movimientos PSD2 | App id en credencial n8n |
| Vercel | Hosting web | Despliegue directo con Vercel CLI |

---

## 11. Métricas de éxito

| Métrica | Objetivo |
|---|---|
| Movimientos pendientes (sin categoría o sin documento) | 0 a fin de mes |
| Exactitud de extracción por IA (foto) | ≥ 95 % de campos de cabecera y líneas en tickets legibles |
| Tiempo medio de clasificación por movimiento | < 15 s |
| Cobertura de vínculo de cargos recurrentes | ≥ 90 % |
| Errores de ingesta duplicada | 0 (idempotencia) |
| Accesibilidad web (Lighthouse) | ≥ 95 |
| Arranque de la app móvil | < 3 s en Expo Go |

---

## 12. Riesgos y limitaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Visión IA con fotos borrosas/arrugadas | Datos incorrectos | Revisión/edición manual; transcripción visible |
| Cambios en el formato de PDFs del emisor | Parser roto | Parsers tolerantes + backfill + logs de ejecución |
| Key de OpenRouter expuesta/rotada | IA caída | Secreto en `n8n/.env.local`; **rotación pendiente** y actualización del `.env` |
| RLS/permisos mal configurados | Fuga o bloqueo | Migraciones con `GRANT` + RLS revisadas; buckets privados |
| App móvil sin login (admin key) | Acceso si se filtra el APK | Uso personal, APK no distribuida, clave en `mobile/.env` |
| Límite de ruta en Windows para el APK | Build falla | Compilar en `C:\mg` (ruta corta) |

---

## 13. Roadmap

### Ahora (corto plazo)
- ⬜ **Rotar** la API key de OpenRouter y actualizar `n8n/.env.local`.
- 🟡 Revisar el comportamiento con fotos reales y afinar el prompt de extracción.
- ⬜ Añadir edición de categoría por línea también en la lista de tickets por foto.

### Siguiente
- ⬜ Reglas de clasificación automática (comercio → categoría/subcategoría) y aprendizaje.
- ⬜ Presupuestos por categoría y alertas.
- ⬜ Exportación (CSV/PDF) de resúmenes y movimientos.
- ⬜ Notificaciones push para sorteos/pagos (ya existe `push_tokens`).
- ⬜ Búsqueda global entre documentos.

### Futuro
- ⬜ Multi‑usuario con RLS por hogar.
- ⬜ Más proveedores y más bancos (PSD2).
- ⬜ Informes anuales y comparativas interanuales.

---

## 14. Criterios de aceptación (resumen)

- **CA-01** Una foto de ticket crea un `photo_ticket` con cabecera y líneas en < 20 s.
- **CA-02** Cada línea puede tener una categoría de producto persistida.
- **CA-03** Un movimiento puede vincularse a cualquiera de los 5 tipos de justificante.
- **CA-04** La vista Pendientes muestra exactamente los movimientos sin categoría o sin documento
  (salvo "no aplica").
- **CA-05** Guardar en la ficha del movimiento persiste concepto, categoría y documento y vuelve al
  listado (web).
- **CA-06** Reimportar un email/extracto no duplica registros.
- **CA-07** Las subcategorías heredan gasto/ingreso y no se permiten más de 2 niveles.
- **CA-08** Los secretos no están en el repositorio y el push a GitHub no se bloquea.

---

## 15. Glosario

- **Movimiento**: cargo/abono de una cuenta bancaria (`bank_transactions`).
- **Justificante**: documento que acredita un movimiento (ticket, factura, repostaje, foto).
- **Vínculo**: relación muchos‑a‑muchos movimiento ↔ justificante.
- **Pendiente**: movimiento sin categoría o sin documento (y no marcado "no aplica").
- **Subcategoría**: categoría hija (2º nivel) que hereda el tipo del padre.
- **Ticket por foto**: ticket capturado con cámara y procesado por visión IA.

---

## 16. Estado de implementación

| Área | Estado |
|---|---|
| Mercadona (ingesta, resumen, productos) | ✅ |
| Iberdrola (facturas, contratos, precios) | ✅ |
| Combustible Waylet | ✅ |
| Proveedores | ✅ |
| Tickets por foto + IA visión | ✅ |
| Cuenta: ingesta, categorías/subcategorías, vínculos | ✅ |
| Regla de completitud + Pendientes + "no aplica" | ✅ |
| Guardado explícito (web y móvil) | ✅ |
| Sorteos (gestión) | ✅ |
| Notificaciones push | 🟡 (solo registro de tokens) |
| Multi‑usuario | ⬜ |
| iOS publicado | ⬜ |
