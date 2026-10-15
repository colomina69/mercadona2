# MEMORY.md — Memoria del proyecto

> Bitácora viva del proyecto **insforge**. Registra **qué se ha hecho**, **decisiones**,
> **problemas y soluciones** y **referencias**. Se actualiza en cada cambio (ver regla en
> `AGENTS.md`).
>
> **Nunca** escribir valores de claves/secretos aquí: solo dónde viven.

---

## 1. Entorno y credenciales (ubicación, sin valores)

| Elemento | Valor / ubicación |
|---|---|
| Proyecto InsForge | `oss-project` · API base `https://insforge.benicolo.com` |
| Claves app | `mercadona-app/.env.local` (server-only) |
| Claves CLI | `.insforge/project.json` (nunca subir) |
| API key InsForge (admin) | en `opencode.json` (MCP `insforge`) y `.env.local` de scripts |
| Owner uid (RLS) | `dfaf6414-958a-4768-9d92-a57493181524` |
| n8n | `https://n8n.benicolo.com` · MCP `.../mcp-server/http` (token en `opencode.json`) |
| Credenciales n8n | `InsForge` (httpHeaderAuth), `Gmail account` (gmailOAuth2) y `Enable Banking RSA` (crypto, app id `4211076d-…`) |
| Modelo IA (OpenRouter) | `deepseek/deepseek-v4.1-flash` (visión); API key **incrustada** en `n8n/ticket-photo.js` (cabecera `Authorization` del nodo `AI Extract`) |
| Vercel | proyecto `insforge` (`prj_20w2s24Z0CefOQSsc0a4J9xCfvon`) · team `team_m0rOwtLX4SM9C2Sw1gUwl8HT` |
| Alias de producción | `https://insforge-mu.vercel.app` |
| Dokploy (backend) | `https://dokploy.benicolo.com` · compose `insforge` (`MSEEh5zwTE_ov2dIjKjM0`) |
| Webhook banca (token) | header `X-Webhook-Token`; valor en n8n (nodo Check Token) y `N8N_BANK_WEBHOOK_TOKEN` |

Repositorio: raíz `insforge/` con la app en `mercadona-app/`, workflows en `n8n/`,
migraciones en `migrations/` y especificaciones SDD en `specs/`.

---

## 2. Stack de la aplicación

- **Next.js 14.2** (App Router, React 18) + **Tailwind CSS 3.4** (no subir a v4).
- **`@insforge/sdk`**:
  - servidor: `src/lib/insforge/server.ts` → `createInsForgeServerClient()` (cookies).
  - navegador: `src/lib/insforge/client.ts` → `getInsforgeBrowser()` (escrituras + storage).
- Autenticación email/contraseña; `middleware.ts` protege `(app)` y redirige a `/login`.
- Dev local en **puerto 4001** (`next dev -p 4001`).
- Rutas: `/` (portada de botones), `/mercadona` (resumen Mercadona), `/tickets`,
  `/tickets/[id]`, `/productos`, `/productos/[name]`, `/movimientos`, `/movimientos/[id]`,
  `/clasificar`, `/categorias`, `/facturas`, `/facturas/[id]`, `/contratos`, `/contratos/[id]`,
  `/combustible`, `/combustible/[id]`, `/proveedores`, `/proveedores/[id]`, `/fotos`,
  `/fotos/[id]`, `/login`.
- **App móvil** (`mobile/`): **Expo SDK 57 + Expo Router** (rutas en `mobile/src/app/`),
  TypeScript. Usa `@insforge/sdk` con **cliente admin** y **sin login**; estado y formateo en
  `mobile/src/lib`, UI en `mobile/src/components`. Se arranca con `npx expo start`. Rutas:
  `/`, `/mercadona`, `/mercadona/tickets[/[id]]`, `/mercadona/productos[/[name]]`,
  `/iberdrola/facturas[/[id]]`, `/iberdrola/contratos[/[id]]`, `/combustible[/[id]]`,
  `/proveedores[/[id]]`, `/fotos[/[id]]`,
  `/cuenta/movimientos[/[id]]`, `/cuenta/clasificar`, `/cuenta/vincular/[id]`, `/cuenta/categorias`, `/sorteos`, `/sorteos/nuevo`,
  `/sorteos/editar/[id]`, `/sorteos/[id]`, `/sorteos/abonados[/nuevo|/[id]]`, `/pdf`.
  Módulos extra: `expo-file-system`, `expo-sharing`, `expo-asset`, `react-native-webview`,
  `expo-image-picker` (cámara/galería) y `expo-text-extractor` (OCR on-device, requiere **dev build/APK**);
  assets `assets/pdfjs/*.pdfjs` (PDF.js) para el visor offline.

---

## 3. Cronología de trabajo

### Sesión A — Puesta en marcha y despliegue
- Se ejecutó la app (`npm run dev`).
- Se publicó en Vercel (proyecto `insforge`) con alias `insforge-mu.vercel.app`.
- Se habilitó el hosting de InsForge configurando `VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID`
  en el entorno del backend (Dokploy, compose `insforge`).
- **Nota**: `insforge deployments deploy` da ERROR en este backend; se usa **Vercel CLI directo**
  (`vercel deploy --prod`) + alias.

### Sesión B — Movimientos bancarios
- Migración `bank-transactions`: tabla `bank_transactions`, bucket `bank-statements`,
  RPC `bank_upsert_transactions` (dedup por `md5(raw_line)`) y `bank_summary`.
- Workflow n8n `bank-statements.js`: webhook `POST /webhook/bank-statements` con token;
  parsea el TXT (Latin‑1), sube el original y hace upsert. Publicado.
- Parser: 7 campos `|`, fecha valor, importe/saldo, CIF, referencia.
- App: `/movimientos` (subida vía server action + resumen + gráficas + filtros),
  `/movimientos/[id]` (editar concepto, categoría, vincular).
- Migración `bank-categories-and-links`: `bank_categories` (semilla 12), `concept`/`category_id`,
  `bank_transaction_links` (muchos‑a‑muchos) con trigger de validación, `bank_match_tickets`.
- `/categorias` (CRUD de tipos gasto/ingreso) y `CategoryManager`.
- Verificado: 1ª subida inserta, 2ª omite; webhook sin token → 401;
  columnas financieras protegidas (solo se editan `concept` y `category_id`).

### Sesión C — Facturas Iberdrola
- Análisis de 2 contratos (SANT LLORENC `279914829`, SANT PERE `448003284`, tarifa 2.0TD).
- Migración `iberdrola-invoices`: `iberdrola_contracts`, `iberdrola_invoices`,
  `iberdrola_invoice_lines` (con **€/kW·día** y **€/kWh**), `iberdrola_invoice_consumption`
  (tramos), RPCs `iberdrola_upsert_invoice`, `iberdrola_summary`, `bank_match_invoices`, bucket `iberdrola`.
- Parser `n8n/iberdrola-parser.js` (cabecera + líneas por fórmulas + consumo por tramo),
  validado contra **29 PDFs** (29/29).
- Workflows `iberdrola-invoices.js` (Gmail trigger) y `iberdrola-backfill.js` (manual).
- **Backfill ejecutado**: 113 facturas, 2 contratos, 533 líneas, 315 registros de tramo.
- App: `/facturas` (agrupada por contrato), `/facturas/[id]` (desglose + tramos + PDF),
  `/contratos` y `/contratos/[id]` (comparativa + evolución de precios), `InvoiceLinker`.
- Commit `761f7f0`.

### Sesión D — Optimización móvil
- Skills instaladas (proyecto): `web-design-guidelines`, `responsive-design`,
  `accessibility`, `vercel-react-best-practices`.
- `viewport`, inputs a 16px en móvil, `prefers-reduced-motion`, `no-scrollbar`, header sticky
  con nav desplazable, tablas → tarjetas en móvil, tablas con scroll en `md+`, áreas táctiles.
- Lighthouse móvil (`/login`): Perf/A11y/BP/SEO **100** (se corrigió contraste de botones
  `bg-emerald-600` → `bg-emerald-700`).

### Sesión E — Navegación y ajustes Iberdrola
- Menú agrupado por fuente: **Mercadona / Iberdrola / Bancos**.
- `/facturas` agrupada por contrato (secciones plegables con totales) y gráficas de
  **evolución €/kWh y €/kW·día**; RPC `iberdrola_price_history`; también en `/contratos/[id]`.
- Fix “object not found” al abrir PDFs: faltaba policy de storage; migración
  `storage-iberdrola-select`. Commits `c2808eb`, `12db4c2`.

### Sesión F — Documentación
- `AGENTS.md` traducido al español.
- Documentación SDD (Spec Kit) en `specs/` (constitución, arquitectura y 001-mercadona,
  002-banca, 003-iberdrola). Commit `97cc546`.
- Creación de este `MEMORY.md`.

### Sesión G — Git
- Se eliminó un fichero `nul` (reservado en Windows) que rompía `git add -A`.
- Se dejó de versionar `mercadona-app/dev.log` y se añadió `**/dev.log` a `.gitignore`.

### Sesión H — Combustible Waylet (Repsol)
- Nueva feature **004-waylet**: lectura de tickets de combustible que llegan por **enlace
  (no adjunto)** en el correo `Waylet - ES GLEM S.L <localidad>` (reenvío propio desde
  `benicolo@gmail.com`).
- Migración `waylet-tickets`: `waylet_tickets` + `waylet_ticket_lines`, RPCs `waylet_upsert_ticket`,
  `waylet_ticket_message_ids`, `waylet_summary`, `bank_match_waylet`; `target_type='waylet'`
  en `bank_transaction_links`. Bucket `waylet` + política de storage.
- Parser `n8n/waylet-parser.js` validado contra el PDF de muestra (estación, fecha/hora,
  carburante, litros, €/L, bruto, descuento, total, pago, tarjeta, nº ticket, id; líneas).
- Workflows `waylet-tickets.js` (Gmail → Extract link → **Download PDF** → Extract → Parse →
  Upsert → Upload) y `waylet-backfill.js`; generador `scripts/n8n-waylet-build.js`.
- App: menú grupo **Combustible**, `/combustible` (totales, gráficas gasto y **€/L**, filtros),
  `/combustible/[id]` (líneas + PDF), `FuelLinker` en `/movimientos/[id]`.
- Documentación SDD `specs/004-waylet/`.
- **Backfill ejecutado**: 8 tickets, 12 líneas, 282,39 L, 444,55 € (€/L bruto 1,6720 · pagado 1,5742);
  7 de 8 emparejan con su cargo `REPSOL WAYLET` del banco.
- **Gotcha**: el extractor de PDF de n8n **conserva las columnas** (`PRODUCTO €/L LITROS IMPORTE`
  + fila `Diesel e+ 1,939 25,78 49,99`), distinto de `pdftotext`; el parser soporta ambos.

### Sesión I — Portada de botones (móvil)
- **Objetivo**: pantalla de inicio tipo hub con botones grandes para los apartados.
- **Cambios**:
  - Nueva portada en `/` (`(app)/page.tsx`): botones/ tarjetas grandes para **Mercadona**
    (`/mercadona`), **Iberdrola** (`/facturas`), **Combustible** (`/combustible`) y
    **Cuenta** (`/movimientos`); diseño mobile-first (`grid-cols-1 sm:grid-cols-2`, áreas
    táctiles ≥104px, iconos y flecha, foco visible, `active:scale`).
  - El resumen de gasto de Mercadona se movió de `/` a **`/mercadona`** (`(app)/mercadona/page.tsx`).
  - `NavLinks`: grupo **Inicio/Portada**; se añade **Resumen** en Mercadona; el grupo
    **Bancos** pasa a llamarse **Cuenta**.
  - `(app)/layout.tsx`: título de cabecera → **🏠 Mis gastos** con enlace a `/`.
- **Decisiones**: "Cuenta" = cuenta bancaria (movimientos/categorías); el dashboard de
  Mercadona vive en `/mercadona`.
- **Verificación**: `npx tsc --noEmit` y `npm run lint` OK; `npm run build` OK (rutas `/` y
  `/mercadona` generadas); dev en http://localhost:4001.
- **Commit**: (pendiente)

### Sesión J — Navegación por secciones (sin menú global)
- **Objetivo**: quitar el menú superior global y navegar por secciones con botones propios.
- **Cambios**:
  - Se elimina `components/NavLinks.tsx`; `(app)/layout.tsx` ya no lo usa.
  - Cabecera: botón **🏠 Inicio** (enlace a `/`) visible desde cualquier página + email + Salir.
  - Nuevo `components/SectionNav.tsx` (cliente, `usePathname`): detecta la sección por prefijo
    de ruta y muestra **pills** con scroll horizontal (`no-scrollbar`), activo `aria-current="page"`
    (`bg-emerald-600 text-white`); se oculta en `/`.
    - Mercadona → Resumen `/mercadona`, Tickets `/tickets`, Productos `/productos`.
    - Iberdrola → Facturas `/facturas`, Contratos `/contratos`.
    - Combustible → Repostajes `/combustible`.
    - Cuenta → Movimientos `/movimientos`, Categorías `/categorias`.
  - Al estar en el layout, aparece en **todas** las páginas de la sección (incluidas detalle).
- **Decisiones**: navegación contextual por sección (pills) en lugar de menú global; Inicio
  siempre accesible desde la cabecera.
- **Verificación**: `npx tsc --noEmit` y `npm run lint` OK; `npm run build` OK; dev en
  http://localhost:4001 (200).
- **Commit**: (pendiente)

### Sesión K — Enable Banking (PSD2 AIS) → InsForge
- **Objetivo**: volcar los movimientos de la cuenta corriente de Banco Sabadell (vía
  Enable Banking) en `bank_transactions`.
- **Cambios**:
  - Migración `20261006071518_enablebanking-transactions`: columnas `account_iban`,
    `account_name`, `source`, `external_id` en `bank_transactions` (+ índices) y RPC
    `bank_upsert_transactions` ampliada (lee los campos nuevos del JSON; `source` por
    defecto `statement_txt`, retrocompatible con el workflow TXT).
  - Workflow n8n (proyecto `enable_bank`): `Enable Banking - Cuenta Corriente`.
    - Firma JWT RS256 con el nodo **Crypto** + credencial cifrada `Enable Banking RSA`
    (los task runners bloquean `require('crypto')` y `$env`).
    - Flujo: `POST /auth` → callback → `POST /sessions` (sesión en static data) →
    `GET /sessions/{id}` + `transactions` (30 días) → `bank_upsert_transactions`.
    Solo **1 llamada al ASPSP por ejecución** (se evitan `details` y `balances`).
    - Entradas: `/webhook/enable-banking-start` (autorizar), `/webhook/enable-banking-refresh`
    (listado+upsert), `/webhook/enable-banking-callback` (registrada en EB); schedule 08:00.
- **Decisiones**:
  - `dedup_hash = 'eb:<iban>:<transaction_id|entry_reference>'`; `source='enable_banking'`.
  - Importe firmado (DBIT negativo / CRDT positivo); `balance` = `balance_after_transaction`.
  - Instantánea diaria de saldo por cuenta en `bank_account_balances`
    (RPC `bank_upsert_account_balances`), también derivada de `balance_after_transaction`
    (sin llamada extra al ASPSP).
- **Problemas y solución**:
  - Task runner internal: `require('crypto')` disallowed y `$env` denegado → firmar con el
    nodo **Crypto** (RSA-SHA256) y `Buffer`/base64url en el Code node.
  - `GET /accounts` no existe en Enable Banking; hay que usar el flujo de sesión.
  - `ASPSP_RATE_LIMIT_EXCEEDED` (HTTP 429) de Sabadell al llamar repetidamente a
    `/details`, `/balances` y `/transactions`: se eliminan `details` y `balances`
    (el saldo se deriva de `balance_after_transaction`) y el nodo de movimientos usa
    `onError: continueRegularOutput` + reintentos, para no romper el workflow.
- **Verificación**: 1er refresco → `inserted=20`; 2º → `inserted=0, skipped=20`. Sesión EB
  válida hasta 2027-04-03.
- **Commit**: (pendiente)

### Sesión L — Saldo de cuenta en la app
- **Objetivo**: mostrar el saldo almacenado (`bank_account_balances`) en la portada y en `/movimientos`.
- **Cambios**:
  - `lib/types.ts`: nuevo tipo `BankAccountBalance`.
  - `/movimientos`: consulta la última instantánea por cuenta (dedupe por `account_iban`) y
    muestra una sección **Saldo de la cuenta** (titular, IBAN, fecha `as_of`, origen).
  - Portada `/`: server component `async` que lee la última instantánea y la muestra en la
    tarjeta **Cuenta** (`Saldo … · fecha`).
- **Decisiones**: se muestra el saldo *almacenado* (snapshot diario), distinto del
  “Último saldo” derivado de movimientos de `bank_summary`.
- **Verificación**: `npx tsc --noEmit` y `npm run lint` OK; `npm run build` OK (tras limpiar
  `.next` por el error `EINVAL` de symlinks/OneDrive).
- **Commit**: (pendiente)

### Sesión M — App móvil Expo + Sorteos (gestión)
- **Objetivo**: crear una app móvil (Expo) de la aplicación y una sección de **Sorteos** con las
  tablas nuevas de InsForge.
- **Cambios**:
  - Nuevo proyecto **`mobile/`** (Expo SDK 57, React 19, RN 0.86, TypeScript, **Expo Router** con
    rutas en `src/app/`). Dependencias: `expo-router`, `react-native-safe-area-context`,
    `react-native-screens`, `expo-linking`, `expo-constants`, `react-native-gesture-handler`.
  - `package.json` → `main: expo-router/entry`; `app.json` → name **Mis Gastos**, `scheme: misgastos`.
    `tsconfig.json` con alias `@/* → ./src/*` (sin `baseUrl`, deprecado en TS 6).
  - `src/lib/`: `insforge.ts` (**cliente admin** con `EXPO_PUBLIC_INSFORGE_URL/API_KEY`), `types.ts`
    (dominio + `Sorteo`/`Pago`), `format.ts`, `theme.ts`, `useAsync.ts`.
  - `src/components/`: `ui.tsx` (Screen, Card, Stat, BigButton, SectionMenu, Field, …), `charts.tsx`
    (barras simples con `View`, sin dependencias nativas), `SorteoForm.tsx`.
  - Pantallas: portada de botones (`index`), **Mercadona** (resumen/tickets/detalle/productos/detalle),
    **Iberdrola** (facturas/contrato + detalle), **Combustible** (listado + detalle), **Cuenta**
    (movimientos + detalle con edición de concepto/categoría y vinculación, categorías CRUD) y
    **Sorteos** (listado, nuevo/editar, detalle con pagos de abonados: alta, marcar pagado/pendiente,
    cantidad ±, método de pago y borrado).
  - `metro.config.js` + `src/shims/crypto.js`: alias del builtin `crypto` de Node (ver gotcha).
  - `PdfButton` (móvil) + visor **dentro de la app** (`/pdf`, `src/app/pdf.tsx`): descarga el PDF
    con la cabecera `Authorization` (buckets privados) a caché (`expo-file-system/legacy`), y lo
    renderiza con **PDF.js empaquetado como asset** (`assets/pdfjs/*.pdfjs`, ext. `pdfjs`) inyectado
    inline (API vía `eval(atob(...))`, worker vía **blob URL**) dentro de un `WebView`
    (`react-native-webview`), **sin CDN**. Botón secundario “Compartir / guardar” (`expo-sharing`).
    En ticket (`mercadona`), factura (`iberdrola`) y repostaje (`waylet`).
- **Decisiones**:
  - **Sin login**: la app usa la **API key admin** de InsForge (`createAdminClient`), ya que las
    tablas financieras tienen RLS de propietario y la anon key no las leería. La clave vive solo en
    `mobile/.env` (gitignored); es una app personal no publicada.
  - Gráficas **sin dependencias nativas** (barras con `View`) para que funcione en Expo Go.
  - `sorteos`/`pagos`: gestión (admin). `abonado_id` **no** referencia a `auth.users` ni hay tabla de
    abonados, así que en “Añadir pago” se introduce el UUID del abonado.
- **Problemas y solución**:
  - El bundle de Metro falla con `Unable to resolve module crypto` (el SDK hace `await import("crypto")`
    en su ruta Node): se resuelve con `metro.config.js` (`resolver.extraNodeModules.crypto` → shim).
  - `npm install` de Expo daba `ERESOLVE`: `.npmrc` con `legacy-peer-deps=true`.
  - TS 6: `baseUrl` deprecado → `paths` sin `baseUrl`.
- **Verificación**: `npx tsc --noEmit` OK; `npx expo export --platform android` empaqueta (1397 módulos).
- **Commit**: (pendiente)

### Sesión N — Abonados de sorteos (móvil)
- **Objetivo**: poder editar los **abonados** y diferenciar mensuales vs extraordinarios (Nadal/Niño).
- **Descubrimiento**: la tabla `abonados` **ya existía** (creada a mano) con `tipo` simple y 28
  filas (todas `mensual`); `pagos.abonado_id` ya apuntaba a ellas.
- **Cambios**:
  - Migración `20261007120000_abonados`: normaliza a **`grupos text[]`** (multi-grupo): añade
    `grupos`, backfill desde `tipo` (`mensual`→{mensual}, `extraordinario`→{extraordinario}),
    `NOT NULL`, `CHECK grupos ⊆ {mensual, extraordinario}`, `DROP COLUMN tipo`, RLS + policy +
    grants, y **FK `pagos.abonado_id → abonados(id) ON DELETE CASCADE`**.
  - App móvil: tipos `Abonado`/`Grupo`; `AbonadoForm`; pantallas `sorteos/abonados` (lista),
    `sorteos/abonados/nuevo`, `sorteos/abonados/[id]` (editar/eliminar + pagos); botón
    **👥 Abonados** en Sorteos.
  - `sorteos/[id]` reescrito: lista los abonados del **grupo del sorteo** (tipo `mensual` ↔ grupo
    `mensual`; tipo `especial` ↔ `extraordinario`), botón **“Dar de alta a los N activos”**,
    marcar pagado/pendiente, cantidad ±, método y borrar; sección **Otros abonados**.
- **Decisiones**: un abonado puede estar en **varios grupos**; el grupo del sorteo se deriva de
  `sorteos.tipo`.
- **Problemas y solución**: el primer intento de migración creaba un índice único de `nombre` y
  falló por un duplicado existente (“coca”); se descartó el único y se normalizó a `grupos`.
- **Verificación**: migración aplicada; `npx tsc --noEmit` OK; `npx expo export --platform android`
  OK.
- **Commit**: (pendiente)

### Sesión O — Cobros por método y décimos (móvil)
- **Objetivo**: editar sorteos (sobre todo los **décimos para vender**) y, al entrar en un sorteo,
  saber **quién ha pagado en efectivo o bizum** y las **cantidades a tener**.
- **Cambios** (móvil, `src/app/sorteos/[id].tsx`):
  - Tarjeta superior con **Décimos para vender / asignados / disponibles** y **Recaudado**, y botón
    **✏️ Editar sorteo** destacado (la edición ya existía en `/sorteos/editar/[id]`).
  - Tarjeta **Cobros**: **Efectivo**, **Bizum** y otros métodos (nº de abonados · décimos · importe),
    **Total cobrado** y **Pendiente**.
  - Lista de abonados **agrupada por método**: *Cobrado en efectivo*, *Cobrado en bizum*,
    *Cobrado (otro método)*, *Pendientes de pago*, *Sin alta en este sorteo*.
  - `SorteoForm`: etiqueta “Décimos para vender (opcional)”.
- **Verificación**: `npx tsc --noEmit` OK; `npx expo export --platform android` OK.
- **Commit**: (pendiente)

### Sesión P — Métodos de pago: solo efectivo/bizum
- **Objetivo**: eliminar el grupo “otro método” (aparecían 2 abonados por `'Efectivo'` en mayúscula).
- **Cambios**:
  - Migración `20261007130000_metodo-pago`: normaliza `lower(btrim(metodo_pago))`
    (`'Efectivo'`→`'efectivo'`), pasa valores inválidos a `NULL`, y añade
    `CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo','bizum'))`.
  - App `sorteos/[id]`: el toggle de método alterna solo **efectivo ↔ bizum**; al marcar **pagado**
    se asigna `efectivo` si no tenía método; el grupo “Cobrado (otro método)” pasa a
    **“Pagados sin método”** (para revisarlos).
- **Verificación**: quedan 168 `efectivo` y 26 `bizum` (los `paid` sin método siguen `NULL`);
  `npx tsc --noEmit` y `npx expo export` OK.
- **Commit**: (pendiente)

### Sesión Q — Pagos antiguos a efectivo
- **Objetivo**: los 39 pagos `paid` sin método (Febrero 2026: 24; Marzo 2026: 15) pasan a contar
  como cobrados.
- **Cambios**: migración `20261007140000_pagos-antiguos-efectivo` → `UPDATE pagos SET
  metodo_pago='efectivo' WHERE estado='paid' AND metodo_pago IS NULL`.
- **Resultado**: **209 efectivo · 26 bizum · 17 pendientes** (sorteo Octubre 2026, aún sin cobrar).
- **Commit**: (pendiente)

### Sesión R — Filtro por año en los resúmenes (web + móvil)
- **Objetivo**: filtrar por **año** los resúmenes de Mercadona, Iberdrola, Combustible y Cuenta.
- **Backend**: migración `20261007150000_mercadona-summary-range` → `mercadona_spend_summary(p_from
  date, p_to date)`; los otros tres (`iberdrola_summary`, `waylet_summary`, `bank_summary`) ya
  aceptaban rango de fechas.
- **Web**: `components/YearFilter.tsx` (pills, param `year`) en `/mercadona`, `/facturas`,
  `/combustible`, `/movimientos`; `lib/years.ts` (`resolveRange`, `yearsFromMonthly`); el selector
  se calcula desde un `*_summary()` sin filtro; los filtros existentes (`Bank/Invoice/Fuel`) y la
  paginación **preservan `year`**.
- **Móvil**: `components/YearFilter.tsx` + `lib/years.ts` en las cuatro pantallas de resumen; el RPC
  se llama con el rango del año y las listas se filtran también.
- **Verificación**: web `npx tsc --noEmit` + `next build` OK; móvil `npx tsc --noEmit` +
  `expo export --platform android` OK; dev en http://localhost:4001.
- **Commit**: (pendiente)

### Sesión S — Desglose por años en contratos de Iberdrola
- **Objetivo**: añadir el desglose por años en los contratos de Iberdrola.
- **Cambios** (sin backend; se agrega desde las facturas ya cargadas):
  - Web `contratos/[id]`: tabla **Desglose por años** (Año · Facturas · Consumo · €/kWh · Importe).
  - Móvil `iberdrola/contratos/[id]`: tarjeta **Desglose por años** (por año: nº facturas · kWh ·
    €/kWh · importe).
- **Verificación**: web `tsc` + `next build` OK; móvil `tsc` + `expo export` OK.
- **Commit**: (pendiente)

### Sesión T — Clasificador de movimientos y rehacer categorías
- **Objetivo**: asignar categoría a cada movimiento, **rehacer las categorías desde cero** y ver/
  vincular los **tickets y facturas archivadas**.
- **Web**: nueva ruta **`/clasificar`** + `components/Classifier.tsx` (filtro por año, "solo sin
  categoría", búsqueda; selección múltiple con **asignación en bloque**; `<select>` de categoría por
  fila; expandir para ver **vinculados** y **sugerencias** de tickets/facturas/repostajes con
  Vincular/Desvincular). `CategoryManager` con botón **Vaciar todas**; `SectionNav` añade
  **Clasificar** al grupo Cuenta.
- **Móvil**: pantalla **`cuenta/clasificar`** (YearFilter + "solo sin categoría"; tarjetas con
  selector de categoría en **modal** y **modal de vinculación**); `categorias` con **Vaciar todas**;
  menús de sección de Cuenta actualizados.
- **Nota**: `bank_transactions.category_id → bank_categories` es `ON DELETE SET NULL`, así que
  vaciar categorías deja los movimientos sin categoría.
- **Verificación**: web `tsc` + `next build` OK (`/clasificar`); móvil `tsc` + `expo export` OK.
- **Commit**: (pendiente)

### Sesión U — Página "Vincular" + sugerencia automática de categoría
- **Objetivo**: que el vincular sea una **página** (no popup) con categoría **manual** + **sugerencia
  automática**.
- **Backend**: RPC `bank_suggest_category(p_transaction_id)` → `{category_id, score, source}`;
  primero por **historial** (mismo comercio/concepto) y si no, por **palabras clave** del movimiento
  contra los nombres de las categorías (`20261007160000` y `20261007160001`).
- **Web**: `TransactionEditor` (`/movimientos/[id]`) muestra **“💡 Sugerida: X [Usar]”**; ya permitía
  categoría manual y crear categorías.
- **Móvil**: nueva página **`/cuenta/vincular/[id]`** (movimiento + categoría manual con sugerencia +
  vinculados + sugerencias + **buscar ticket/factura archivada**). El clasificador (`/cuenta/clasificar`)
  ahora **abre esa página** al tocar un movimiento (sin popups).
- **Nota**: las categorías estaban a **0** (se vaciaron para rehacerlas); la sugerencia funcionará
  en cuanto se creen categorías y haya historial.
- **Verificación**: web `tsc` + `next build` OK; móvil `tsc` + `expo export` OK.
- **Commit**: (pendiente)

### Sesión V — APK de la app móvil (build local)
- **Objetivo**: generar un **APK instalable**.
- **Entorno**: JDK 21 de Android Studio (`C:\Program Files\Android\Android Studio\jbr`), Android SDK
  en `%LOCALAPPDATA%\Android\Sdk`. No se usó `eas build` (requiere login).
- **Pasos**:
  - `npx expo prebuild -p android --no-install` → `android/` (paquete `com.tonicolomina.misgastos`).
  - `android/local.properties` con `sdk.dir` (gitignored).
  - `JAVA_HOME=<jbr> ./gradlew assembleRelease` en `android/` (firma con el debug keystore).
  - APK: `android/app/build/outputs/apk/release/app-release.apk` (**~85 MB**) → copiado a
    `mobile/mis-gastos.apk` (gitignored con `*.apk`).
- **Gotcha crítico (Windows)**: `assembleRelease` falla con `Filename longer than 260 characters`
  (CMake/ninja sobre `node_modules/react-native-safe-area-context/...`). **`subst` y junctions NO
  sirven** (AGP canonicaliza la ruta larga). Solución: **copiar el proyecto a una ruta corta**
  (`C:\mg`, ~1,5 GB) y compilar allí (`C:\mg\android`); luego copiar el APK de vuelta.
- **Instalar**: en el móvil, permitir "instalar apps de origen desconocido" y abrir el APK.
- **Commit**: (pendiente)

### Sesión W — Facturas de proveedores (Transportes Albero S.L.)
- **Objetivo**: replicar el flujo de Mercadona para el proveedor **Transportes Albero S.L.**
  (NIF B03075116, gasóleo C), con sección **genérica de proveedores**.
- **Muestra**: `docs/samples/albero/NE_0001_25760098_20250120.pdf` (nota de entrega/factura).
- **Parser**: `n8n/albero-parser.js` (soporta layouts de `pdftotext` y de n8n) → nº factura, fecha,
  albarán, producto, cantidad, precio, base/IVA/total, forma de pago, matrícula, conductor,
  densidad, CAE/CRE.
- **Backend**: migración `20261007170000_supplier-invoices` → `supplier_invoices` +
  `supplier_invoice_lines`, RLS owner, RPC `supplier_invoice_upsert` (idempotente por
  proveedor+nº factura), `supplier_invoice_message_ids`, `supplier_summary(p_from,p_to,p_supplier)`,
  `bank_match_supplier` y `target_type='supplier'` en `bank_transaction_links`. Bucket `suppliers`
  + migración `20261007170001_storage-suppliers-select` (policy).
- **n8n**: workflow `n8n/supplier-invoices.js` (**id `HCpCCq9WSWQNqmCT`**, publicado): Gmail
  (`from:maque@alberosl.com has:attachment`) → Expand PDFs → Extract → **Parse Albero** →
  `supplier_invoice_upsert` → Reattach → Upload a `suppliers`.
  - **Backfill**: `n8n/supplier-backfill.js` (**id `JlVeaSE06Kn34oiu`**, manual) lee **todas** las
    facturas antiguas del proveedor en Gmail, con dedup por `supplier_invoice_message_ids` y por
    objetos ya en el bucket.
- **App**: web `/proveedores` (+ `/proveedores/[id]`) y móvil `/proveedores` (+ `[id]`), con
  filtro por año, totales y PDF; grupos/nav y portada actualizados.
- **Seed**: subida la factura de ejemplo al bucket y llamada a la RPC (invoice id
  `0b3734c0-c978-4b59-8a2a-5e3c6451828d`).
- **Verificación**: web `tsc` + `next build` OK (`/proveedores`); móvil `tsc` + `expo export` OK.
- **Problemas y solución (backfill)**: cada correo trae **2 PDFs**: la **factura** (`NE_...`, con nº
  de factura) y un **documento de responsabilidad** (`DU-...`, sin nº). Se **guardan los dos** en el
  bucket, pero solo la factura genera registro. Implementación: el nodo *Parse Albero* **agrupa por
  `messageId`** (factura + responsable) y añade a la fila `responsibility_pdf_key/url/filename`
  (columnas nuevas, migración `20261007180000_supplier-responsibility-doc`); el nodo **Split Files**
  emite 2 items (factura y responsable) que el nodo *Upload* sube a `suppliers`. Los PDFs sin nº de
  factura ya **no** provocan error (`NOT NULL`).
- **Gotcha**: el dedup del backfill es por `message_id`; si una factura se importó **antes** de
  soportar el DU, no se reprocesa. Para reimportar con el documento hay que **vaciar**
  `supplier_invoices` y relanzar. Verificado: tras vaciar + reejecutar, quedan 2 facturas con su
  `responsibility_pdf_key` y **4 PDFs** en `suppliers` (NE + DU de cada correo).
- **Pendiente**: en n8n, **asignar manualmente** las credenciales `Gmail account` e `InsForge` al
  workflow nuevo.
- **Commit**: (pendiente)

### Sesión X — Tickets por foto (OCR en la app → n8n)
- **Objetivo**: enviar una **foto de un ticket** desde la app, reconocer el texto, guardarla y
  revisarla/editar los datos.
- **Backend**: migración `20261008100000_photo-tickets` → tablas `photo_tickets` +
  `photo_ticket_lines`, RLS owner, RPC `photo_ticket_create(jsonb)` y
  `photo_ticket_update(id, campos, líneas)`. Bucket privado **`receipts`** +
  `20261008100100_storage-receipts-select`.
- **n8n**: workflow `n8n/ticket-photo.js` (**id `LP8wMw6VkQgsnqYX`**, publicado): webhook
  `POST /webhook/ticket-photo` (+ token `ph_ti_…`) → sube la imagen a `receipts` → `photo_ticket_create`
  → responde `{ok,id}`. Token en `N8N_PHOTO_WEBHOOK_URL/TOKEN` (web `.env.local`) y
  `EXPO_PUBLIC_N8N_PHOTO_WEBHOOK_*` (móvil `.env`).
- **OCR clásico en la app** (no en n8n): web con `tesseract.js` (español) y móvil con
  `expo-text-extractor` (ML Kit/Vision). Luego la app **POSTea** imagen + texto al webhook.
- **App**: web `/fotos` (+ `/fotos/[id]` con editor) y móvil `/fotos` (+ `[id]`, cámara/galería);
  nav/portada actualizados.
- **Notas**: `expo-text-extractor` es módulo nativo → el móvil necesita **dev build/APK** (no Expo Go).
  Cargarlo en **Expo Go cierra la app** (crash nativo); por eso el OCR se **desactiva en Expo Go**
  (`Constants.appOwnership === 'expo'` → `CAN_OCR=false`) y se importa de forma perezosa con
  try/catch. En Expo Go la foto se sube **sin OCR** (rellenas a mano); en APK/dev build hace OCR.
- **Gotcha (subida)**: el `fetch` de Expo SDK 57 rechaza el `FormData` clásico con
  `{ uri, name, type }` (`Unsupported FormDataPart implementation`), y su `Blob` global no acepta
  `ArrayBuffer` (`Creating blobs from 'ArrayBuffer'… are not supported`). Solución: añadir
  directamente el **`File`** de `expo-file-system` (implementa `bytes()`, que el `fetch` sí admite):
  `form.append('data', new File(uri) as any, name)`.
- **APK**: recompilado con los módulos nativos (`expo-image-picker` + `expo-text-extractor`) →
  `mobile/mis-gastos.apk` (~86 MB). `expo prebuild -p android --clean` + build en `C:\mg` (ver
  Sesión V).
- **Gotcha (n8n webhook multipart)**: el nodo Webhook guarda el fichero como **`data0`**
  (nombre-campo + índice), NO `data`. El `Build` lee la **primera clave binaria**
  (`Object.keys(item.binary)[0]`). Además, los nodos HTTP de este workflow llevan la cabecera
  **`Authorization: Bearer <API key>`** en `headerParameters` (no usan credencial), así no hace
  falta asignar la credencial `InsForge`.
- **Parseo del OCR**: el `Build` extrae del texto OCR (genérico) **fecha** (dd/mm/aaaa o ISO),
  **tienda** (primera línea con letras), **nº ticket**, **subtotal** y **total** (el **último**
  `\bTOTAL\b` real, sin confundirlo con `SUBTOTAL`), y los pasa a `photo_ticket_create` → la app
  abre el detalle con los campos ya rellenos (editables).
- **Pendiente**: nada en n8n (el workflow ya funciona; se probó con `curl` → sube la imagen y crea
  la fila con su `image_key`).
- **Verificación**: web `tsc` + `next build` OK (`/fotos`); móvil `tsc` + `expo export` OK.
- **Commit**: (pendiente)

### Sesión Y — Tickets por foto con agente de IA (visión)
- **Objetivo**: al fotografiar un ticket, que un **agente de IA** extraiga los datos (cabecera +
  líneas) en lugar del parseo por regex genérica (que "no cogía bien los datos").
- **Backend**: migración `20261014120000_photo-ticket-create-lines`:
  `photo_ticket_create(jsonb)` → `photo_ticket_create(p_ticket jsonb, p_lines jsonb DEFAULT '[]')`
  que inserta cabecera **+ líneas** (antes solo las insertaba `photo_ticket_update`).
- **n8n** (`n8n/ticket-photo.js`, id `LP8wMw6VkQgsnqYX`) — nuevo flujo:
  `Webhook → Check Token → Build & Encode → Upload Image → AI Extract → Parse AI → DB Create → Respond OK`.
  - `Build & Encode`: lee el binario (`data0`), arma `key`, `captured_at`, `raw_text` y una **data URL
    base64** de la imagen (`this.helpers.getBinaryDataBuffer` + `toString('base64')`).
  - `AI Extract`: HTTP a OpenRouter `https://openrouter.ai/api/v1/chat/completions`, modelo
    **`deepseek/deepseek-v4.1-flash`** (multimodal text+image), `temperature: 0`, `max_tokens: 4000`;
    `system` con el esquema JSON y `user` con `text` + `image_url` (data URL). Auth por credencial
    **`OpenRouter`** (Header Auth).
  - `Parse AI`: `JSON.parse` defensivo (quita fences), decimales con coma → punto y fecha `YYYY-MM-DD`;
    rellena `p_ticket` + `p_lines`.
- **Decisión**: la imagen se envía **inline** (base64) porque los buckets son privados (no hay URL
  pública); se usa la **visión** del modelo y la app **deja de hacer OCR**.
- **App**: se elimina el OCR (web `tesseract.js`, móvil `expo-text-extractor`); la app solo sube la
  imagen. El móvil vuelve a funcionar en **Expo Go** (sin módulo nativo). El detalle sigue mostrando
  "Texto OCR": ahora contiene la transcripción que devuelve el modelo.
- **Problemas y solución**:
  - El **Model Gateway de InsForge no tiene key de OpenRouter** configurada (`ai setup` falla); se
    incrustó una **API key propia de OpenRouter** en el workflow (cabecera `Authorization` del nodo
    `AI Extract`), igual que ya se hace con la del InsForge. Así se evita la credencial (el MCP de n8n
    no asigna credenciales).
- **Verificación**: workflow `validate` OK y **publicado**; **prueba end-to-end** (POST al webhook con
  una imagen de ticket) → la IA extrajo tienda, nº ticket, fecha, subtotal, total **y las 5 líneas**
  correctamente; la imagen quedó en `receipts`. Web `tsc` + `next build` OK (`/fotos`); móvil `tsc` +
  `expo export` OK. Datos de prueba eliminados.
- **Commit**: (pendiente)

### Sesión Z — Visor de "foto original" (tickets por foto)
- **Objetivo**: arreglar el botón **"Ver foto original"** de los tickets por foto.
- **Problema**: usaba `PdfButton`, que abre el visor **PDF.js** (`/pdf`); las fotos son **JPG/PNG**,
  así que no se renderizaban.
- **Cambios**:
  - **Móvil**: nuevo visor `mobile/src/app/foto.tsx` (descarga con `Authorization` vía
    `expo-file-system/legacy` y muestra la imagen con `resizeMode="contain"`) + componente
    `mobile/src/components/ImageButton.tsx` (ver + compartir/guardar). `fotos/[id].tsx` usa `ImageButton`.
  - **Web**: component `mercadona-app/src/components/ImageButton.tsx` (descarga el blob y lo muestra en
    un **overlay/modal** a pantalla completa, sin `window.open`). `fotos/[id]/page.tsx` usa `ImageButton`.
- **Verificación**: web `tsc` + `next build` OK; móvil `tsc` + `expo export` OK.
- **APK**: regenerado (`mobile/mis-gastos.apk`, ~86 MB) con el fix del visor (build en `C:\mg`).
- **Commit**: (pendiente)

### Sesión AA — Tickets por foto: categoría por línea y vínculo con movimientos
- **Objetivo**: (1) poder asignar una **categoría** a cada **línea de producto** del ticket (catálogo
  propio) y (2) **vincular** los tickets por foto con los **movimientos bancarios**.
- **Backend**: migración `20261014130000_photo-ticket-links-and-line-categories`:
  - Nueva tabla **`photo_ticket_categories`** (catálogo propio, RLS owner) con 11 categorías semilla.
  - `photo_ticket_lines.category_id → photo_ticket_categories(id)` (+ índice).
  - `bank_transaction_links.target_type` amplía a **`photo_ticket`**; `bank_links_validate_target`
    valida contra `photo_tickets`.
  - RPC **`bank_match_photo_tickets(p_transaction_id, p_days default 5, p_tolerance default 0.02)`**.
  - `photo_ticket_create`/`photo_ticket_update` persisten `category_id` por línea.
- **Web**: `TicketPhotoEditor` con `<select>` de categoría por línea + alta rápida (＋, `prompt`);
  `fotos/[id]` carga las categorías. Nuevo `PhotoTicketLinker` en `/movimientos/[id]`
  (vinculados + sugerencias ±5 días + buscar).
- **Móvil**: `fotos/[id].tsx` con selector de categoría por línea (**modal** + alta de categoría);
  `/cuenta/vincular/[id]` incluye sugerencias, vinculados y búsqueda de **tickets por foto**.
- **Decisión**: el catálogo de categorías de producto es **independiente** de `bank_categories`
  (a petición del usuario); la vinculación se hace desde la **ficha del movimiento**.
- **Verificación**: web `tsc` + `next build` OK; móvil `tsc` + `expo export` OK. RPC probada: la línea
  guarda su `category_id` ("Alimentación").
- **Commit**: (pendiente)

### Sesión AB — Regla de completitud de movimientos (pendientes + "no aplica")
- **Objetivo**: cada movimiento bancario debe tener **categoría** y **vínculo** (ticket/factura/
  repostaje/proveedor/ticket por foto). Avisar/listar los que faltan y permitir marcar
  **"sin documento (no aplica)"**.
- **Backend**: migración `20261014140000_bank-pending-movements`:
  - `bank_transactions.document_na boolean NOT NULL DEFAULT false` (editable; `GRANT UPDATE`).
  - RPC `bank_pending_count(p_from, p_to)` → `{total, missing_category, missing_link}`.
  - RPC `bank_pending_movements(p_from, p_to, p_limit, p_offset)` → lista con `needs_category`/`needs_link`.
- **Web**: nueva ruta **`/pendientes`** (recuentos + lista con etiquetas "Falta categoría"/"Falta
  documento", enlaza a `/movimientos/[id]`); `SectionNav` (grupo Cuenta) + tarjeta **Pendientes** en la
  portada si hay pendientes; casilla "Sin documento (no aplica)" en `TransactionEditor`.
- **Móvil**: nueva pantalla **`/cuenta/pendientes`** (`Stat` total/sin categoría/sin documento + lista →
  `/cuenta/vincular/[id]`); añadida al `SectionMenu` de Cuenta y botón en la portada; toggle
  "Sin documento (no aplica)" en `/cuenta/vincular/[id]`.
- **Decisión**: **no se bloquea**; se avisa y se permite marcar "no aplica" para movimientos sin
  documento posible (nómina, comisiones…). "Vínculo" = cualquier `target_type` de `bank_transaction_links`.
- **Verificación**: `bank_pending_count()` → 429 pendientes (429 sin categoría, 427 sin documento).
  Web `tsc` + `next build` + `next lint` OK; móvil `tsc` + `expo export` OK.
- **Commit**: (pendiente)

### Sesión AC — Subcategorías de categorías + alta al clasificar
- **Objetivo**: jerarquía **categoría → subcategoría** en `bank_categories`, gestionable en el apartado
  de Categorías, y poder **crear categorías y subcategorías mientras se clasifica** un movimiento.
- **Backend**: migración `20261014150000_bank-subcategories`:
  - `bank_categories.parent_id` (FK self, `ON DELETE CASCADE`) + índice.
  - Unicidad por `(parent_id, lower(name))`; se elimina la unicidad global de nombre.
  - Trigger `bank_categories_validate_parent`: máx. **2 niveles**, sin auto-referencia, una categoría con
    hijos no puede convertirse en hija; la **subcategoría hereda el `kind`** del padre.
- **Web**:
  - `CategoryCreator` (nombre + tipo + padre) y `CategoryOptions` (select con subcategorías indentadas).
  - `CategoryManager` (`/categorias`): árbol Gastos/Ingresos con subcategorías, "+ Subcategoría",
    renombrar/borrar; alta con el creator.
  - `Classifier` (`/clasificar`): creator inline + select agrupado (estado local de categorías).
  - `TransactionEditor`: select agrupado + creator (crea y asigna).
- **Móvil**:
  - `CategoryCreator` móvil (nombre + tipo + "Depende de" con chips de categorías raíz).
  - `/cuenta/categorias`: árbol con subcategorías (`↳`) + creator + borrar.
  - `/cuenta/vincular/[id]`: pills con subcategorías indentadas + sección "Añadir categoría o subcategoría".
- **Decisión**: solo **2 niveles** (categoría > subcategoría); las subcategorías heredan el tipo del padre.
  Todos los `select` de `bank_categories` incluyen ya `parent_id`.
- **Verificación**: trigger probado (sub insertada hereda `kind='expense'`); web `tsc` + `next build` +
  `next lint` OK; móvil `tsc` + `expo export` OK.
- **Commit**: (pendiente)

### Sesión AD — Guardar el movimiento al clasificar/vincular (móvil)
- **Objetivo**: en la pantalla móvil **"Vincular y clasificar"** faltaba poder **guardar el movimiento
  con los cambios**.
- **Cambios**:
  - `mobile/src/app/cuenta/vincular/[id].tsx`: nueva sección **Movimiento** con **Concepto** editable y
    botón **Guardar** (persiste `concept`, `category_id`, `document_na`) con confirmación "Guardado ✓".
    Los vínculos y las pills de categoría siguen guardándose al instante.
  - `mobile/src/lib/useAsync.ts`: nuevo `refresh()` **silencioso** (sin `loading`).
  - Listas de Cuenta (`/cuenta/pendientes`, `/cuenta/clasificar`, `/cuenta/movimientos`) se refrescan
    **al recibir foco** (`useFocusEffect`) para reflejar los cambios al volver.
- **Verificación**: móvil `tsc` + `expo export` OK.
- **Commit**: (pendiente)

### Sesión AE — Guardado explícito en la ficha del movimiento (web)
- **Objetivo**: en `/movimientos/[id]`, al **clasificar** (concepto/categoría/documento) y **vincular** no
  quedaba claro que se guardara: el Guardar navegaba fuera y al vincular podía perderse lo editado.
- **Cambios**:
  - `TransactionEditor`: el **Guardar** guarda y **vuelve a `/movimientos`**, e indica
    **"• Cambios sin guardar"** mientras haya ediciones pendientes.
  - Los **linkers** (tickets, facturas, combustible, tickets por foto) emiten el evento
    `movement:save` antes de refrescar; la ficha lo escucha y **persiste los cambios del movimiento**
    al vincular/desvincular (los links se siguen guardando al instante).
- **Verificación**: web `tsc` + `next lint` + `next build` OK.
- **Commit**: (pendiente)

---

## 4. Base de datos (InsForge / Postgres)

### Tablas
- **Mercadona**: `mercadona_tickets`, `mercadona_ticket_items`, `mercadona_products`,
  `mercadona_product_aliases`, `mercadona_lines`.
- **Banca**: `bank_transactions` (con `concept`, `category_id`, `document_na`, `dedup_hash` unique, y
  `source`, `account_iban`, `account_name`, `external_id`), `bank_categories` (con `parent_id` para
  subcategorías, 2 niveles),
  `bank_transaction_links`, `bank_account_balances` (instantánea diaria de saldo).
- **Iberdrola**: `iberdrola_contracts`, `iberdrola_invoices`, `iberdrola_invoice_lines`,
  `iberdrola_invoice_consumption`.
- **Combustible (Waylet)**: `waylet_tickets`, `waylet_ticket_lines`.
- **Proveedores**: `supplier_invoices` (proveedor, nº factura único por proveedor, fechas,
  producto/cantidad/precio, base/IVA/total, forma de pago, `pdf_key`, `message_id`,
  `responsibility_pdf_key`/`url`/`filename` para el documento de responsabilidad),
  `supplier_invoice_lines`.
- **Tickets por foto**: `photo_tickets` (`captured_at`, `purchased_at`, `store_name`,
  `ticket_number`, `total`, `subtotal`, `status` ∈ {pendiente, revisado}, `raw_text`, `image_key`,
  `image_url`, `notes`), `photo_ticket_lines` (con `category_id → photo_ticket_categories`),
  `photo_ticket_categories` (catálogo propio de categorías de producto, RLS owner).
- **Sorteos**: `sorteos` (`nombre`, `fecha`, `precio`, `tipo` ∈ {mensual, especial},
  `decimos_totales`), `abonados` (`nombre`, `grupos text[]` ⊆ {mensual, extraordinario}, `activo`),
  `pagos` (`abonado_id` → `abonados(id)` ON DELETE CASCADE, `sorteo_id` → `sorteos`, `estado` ∈
  {pending, paid}, `fecha_pago`, `metodo_pago` ∈ {efectivo, bizum} o NULL, `cantidad`, único
  `(abonado_id, sorteo_id)`),
  `push_tokens` (`token` único, `platform`). RLS: `sorteos`/`pagos`/`abonados` abiertas a `public`,
  `push_tokens` a `authenticated`. Sin RPCs propias.

### RPCs
- Mercadona: `mercadona_upsert_ticket`, `mercadona_ticket_message_ids`,
  `mercadona_spend_summary` (con `p_from`/`p_to`), `mercadona_products`, `mercadona_product_history`.
- Banca: `bank_upsert_transactions`, `bank_upsert_account_balances`, `bank_summary`,
  `bank_match_tickets`, `bank_match_invoices`,   `bank_suggest_category` (sugerencia de categoría por
  historial/comercio), `bank_links_validate_target` (trigger), `bank_pending_count` y
  `bank_pending_movements` (regla de completitud: categoría + vínculo).
- Iberdrola: `iberdrola_upsert_invoice`, `iberdrola_invoice_message_ids`,
  `iberdrola_summary`, `iberdrola_price_history`.
- Waylet: `waylet_upsert_ticket`, `waylet_ticket_message_ids`, `waylet_summary`,
  `bank_match_waylet`.
- Proveedores: `supplier_invoice_upsert`, `supplier_invoice_message_ids`, `supplier_summary`,
  `bank_match_supplier`.
- Tickets por foto: `photo_ticket_create` (acepta `p_ticket` + `p_lines` con `category_id`),
  `photo_ticket_update`. Banca: `bank_match_photo_tickets` (vincular movimiento ↔ ticket por foto).

### Buckets (todos privados)
`mercadona`, `bank-statements`, `iberdrola`, `waylet`, `suppliers`, `receipts`.
Políticas de lectura en `storage.objects` para `mercadona`, `iberdrola`, `waylet`, `suppliers` y
`receipts` (owner).

### Migraciones aplicadas
`20260930082032_bank-transactions`, `20260930090015_bank-categories-and-links`,
`20260930090015`…, `20261001092559_iberdrola-invoices`,
`20261001094816_iberdrola-message-ids-obj`, `20261001133632_storage-iberdrola-select`,
`20261001134653_iberdrola-price-history`, `20261002133047_waylet-tickets`,
`20261002133222_storage-waylet-select`, `20261006071518_enablebanking-transactions`,
`20261006075208_account-balances`, `20261007120000_abonados`, `20261007130000_metodo-pago`,
`20261007140000_pagos-antiguos-efectivo`, `20261007150000_mercadona-summary-range`,
`20261007160000_bank-suggest-category`, `20261007160001_bank-suggest-category-keywords`,
`20261007170000_supplier-invoices`, `20261007170001_storage-suppliers-select`,
`20261007180000_supplier-responsibility-doc`, `20261008100000_photo-tickets`,
`20261008100100_storage-receipts-select`, `20261014120000_photo-ticket-create-lines`,
`20261014130000_photo-ticket-links-and-line-categories`, `20261014140000_bank-pending-movements`,
`20261014150000_bank-subcategories`.

---

## 5. Workflows n8n

| Fichero | Trigger | Función |
|---|---|---|
| `n8n/mercadona-tickets-new.js` | Gmail | Tickets nuevos → PDF → RPC → bucket `mercadona` |
| `n8n/mercadona-tickets.js` | Manual | Backfill tickets |
| `n8n/bank-statements.js` | Webhook + token | Extracto TXT → RPC → bucket `bank-statements` |
| `n8n/iberdrola-invoices.js` | Gmail | Facturas nuevas → RPC → bucket `iberdrola` |
| `n8n/iberdrola-backfill.js` | Manual | Backfill facturas |
| `n8n/iberdrola-parser.js` | (módulo) | Parser Iberdrola compartido |
| `n8n/waylet-tickets.js` | Gmail | Ticket Waylet → extrae enlace → descarga PDF → RPC → bucket `waylet` |
| `n8n/waylet-backfill.js` | Manual | Backfill tickets Waylet |
| `n8n/waylet-parser.js` | (módulo) | Parser Waylet compartido |
| `n8n/supplier-invoices.js` | Gmail | Facturas de proveedor (Albero) → PDF → RPC → bucket `suppliers` (id `HCpCCq9WSWQNqmCT`) |
| `n8n/supplier-backfill.js` | Manual | Lee facturas antiguas de Albero (dedup por `message_id`) → RPC → bucket (id `JlVeaSE06Kn34oiu`) |
| `n8n/albero-parser.js` | (módulo) | Parser Transportes Albero |
| `n8n/ticket-photo.js` | Webhook + token | Foto de ticket → bucket `receipts` → **agente IA (visión, OpenRouter `deepseek/deepseek-v4.1-flash`)** extrae cabecera + líneas → `photo_ticket_create` (id `LP8wMw6VkQgsnqYX`) |
| (proyecto `enable_bank`) Enable Banking — Cuenta Corriente | Manual / Webhook / Schedule | Cuenta Sabadell (AIS) → `bank_upsert_transactions` |

Generación/publicación desde CLI: `scripts/n8n-build.js` (necesita `N8N_MCP_TOKEN`)
y `scripts/n8n-iberdrola-build.js` (genera los workflows de Iberdrola incrustando el parser).

---

## 6. Decisiones clave

1. **Idempotencia por clave natural**: `message_id` (emails), `invoice_number` (facturas),
   `dedup_hash = md5(raw_line)` (movimientos).
2. **Datos crudos inmutables**; lo editable va en columnas/tablas aparte.
3. **InsForge como única fuente**; SDK para la app, CLI para infraestructura.
4. **Hosting**: Vercel CLI directo (el `deployments deploy` de InsForge falla en este backend).
5. **Gráficas**: los componentes cliente reciben props **serializables** (`decimals`, `suffix`),
   nunca funciones (Server → Client).
6. **Parser Iberdrola**: líneas derivadas de las **fórmulas**, total de cabecera autoritativo.
7. **Modelo específico de Iberdrola** (`iberdrola_*`) a petición; vínculos genéricos por
   `bank_transaction_links.target_type ∈ {ticket, invoice, waylet, supplier, photo_ticket}`.
8. **App móvil sin login con la API key admin**: evita la RLS de propietario de las tablas
   financieras; es personal y no se publica. La clave solo vive en `mobile/.env` (gitignored).
9. **Sorteos** como gestión (admin) sobre `sorteos`/`pagos`; sin pasarela de pago (se marca
   `estado` y `metodo_pago` a mano).

---

## 7. Problemas conocidos y soluciones

| Problema | Solución aplicada |
|---|---|
| `insforge deployments deploy` → ERROR | Desplegar con `vercel deploy --prod` y alias |
| El MCP de n8n no asigna credenciales a nodos HTTP | Asignar **manualmente** `InsForge` (y `Gmail account`) en la UI de n8n |
| Reserved secrets de InsForge no se pueden borrar/editar por CLI | Evitar crearlos; reportado a InsForge |
| RPC nueva no encontrada (PostgREST cache) | `SELECT pg_notify('pgrst','reload schema')` |
| Workflow n8n se corta si una RPC devuelve `[]` | Devolver objeto `{ids:[...]}` |
| PDF no válido rompe la extracción | `onError: continue` en *Extract PDF File* |
| Ticket Waylet sin adjunto (solo enlace en el correo) | Extraer la URL y descargar el PDF con HTTP (`responseFormat: 'file'`) antes de parsear |
| n8n (Extract PDF) conserva columnas distintas de `pdftotext` | Parser con soporte de ambos layouts (filas en una línea vs. apiladas) |
| `binaryMode: separate` deja `binary.data` vacío en Code | Usar `this.helpers.getBinaryDataBuffer(...)` |
| `String.raw` no permitido por el SDK de n8n | Incrustar el parser como string JSON (generador) |
| “object not found” al abrir PDF | Añadir política `storage.objects` del bucket |
| `next build` con `next dev` corriendo corrompe `.next` | Parar dev, `rm -rf .next`, build; reiniciar dev |
| Fichero `nul` rompe `git add` | `rm -f ./nul` |
| Contraste insuficiente (botones verdes) | `bg-emerald-600` → `bg-emerald-700` |
| Metro no resuelve `crypto` (import dinámico del SDK) | Alias en `metro.config.js` → `src/shims/crypto.js` |
| `npm install` en Expo da `ERESOLVE` | `mobile/.npmrc` con `legacy-peer-deps=true` |
| TS 6: opción `baseUrl` deprecada | Usar `paths` sin `baseUrl` |
| Charts con `key={d.label}` (labels repetidos: tiendas con mismo nombre) | Clave única `\`${d.label}-${i}\`` en `BarChart`/`RankBars` |
| `createSignedUrl` con la API key admin da un strategy `direct` que exige cabecera `Authorization` (la URL no abre en el navegador) | Descargar con auth (`File.downloadFileAsync` / `expo-file-system`) y abrir en local |
| El `WebView` de Android no renderiza PDF nativo | Visor propio `/pdf` con **PDF.js** empaquetado como asset + inline (API `eval`, worker blob) en `react-native-webview` |
| El visor se quedaba en “Cargando PDF…” (el `<script src>` del CDN de PDF.js no cargaba en el WebView) | Empaquetar `pdf.min.js`/`pdf.worker.min.js` como assets (ext. `pdfjs` en `metro.config.js`) y leerlos en base64 para inyectarlos inline |
| “Ver foto original” de un ticket (JPG/PNG) usaba el visor PDF.js y no se veía | Visor de imagen dedicado (`/foto` móvil + overlay web) y componente `ImageButton` en vez de `PdfButton` |

---

## 8. Comandos útiles

```bash
# App
cd mercadona-app && npm run dev          # http://localhost:4001
npm run build

# App móvil (Expo)
cd mobile && npx expo start              # Metro / Expo Go
npx tsc --noEmit                         # typecheck
npx expo export --platform android       # valida el bundle sin dispositivo

# APK Android (local, Windows) — ver Sesión V
# JDK: C:\Program Files\Android\Android Studio\jbr   SDK: %LOCALAPPDATA%\Android\Sdk
npx expo prebuild -p android --no-install
# Copiar el proyecto a ruta corta (C:\mg) para evitar el límite 260 chars de CMake:
robocopy "<repo>\mobile" "C:\mg" /E /XD "<repo>\mobile\android\app\.cxx" "<repo>\mobile\android\app\build" "<repo>\mobile\android\build" "<repo>\mobile\android\.gradle" "<repo>\mobile\.expo"
# Luego:  cd C:\mg\android && JAVA_HOME=<jbr> ./gradlew assembleRelease
# APK -> C:\mg\android\app\build\outputs\apk\release\app-release.apk

# InsForge CLI (raíz)
npx -y @insforge/cli db migrations new <nombre>
npx -y @insforge/cli db migrations up <archivo.sql>
npx -y @insforge/cli db query "SELECT ..." --json
npx -y @insforge/cli deployments list

# Despliegue (Vercel directo)
npx -y vercel@latest deploy --prod --yes --token <TOKEN>

# n8n (desde raíz)
N8N_MCP_TOKEN=<jwt> node scripts/n8n-build.js n8n/<wf>.js validate|create|update|publish ...
node scripts/n8n-iberdrola-build.js      # regenera los workflows de Iberdrola
```

---

## 9. Plantilla de entrada nueva

```
### AAAA-MM-DD — <título>
- **Objetivo**:
- **Cambios** (ficheros/tablas/workflows):
- **Decisiones**:
- **Problemas y solución**:
- **Verificación**:
- **Commit**:
```
