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
  `/combustible`, `/combustible/[id]`, `/login`.
- **App móvil** (`mobile/`): **Expo SDK 57 + Expo Router** (rutas en `mobile/src/app/`),
  TypeScript. Usa `@insforge/sdk` con **cliente admin** y **sin login**; estado y formateo en
  `mobile/src/lib`, UI en `mobile/src/components`. Se arranca con `npx expo start`. Rutas:
  `/`, `/mercadona`, `/mercadona/tickets[/[id]]`, `/mercadona/productos[/[name]]`,
  `/iberdrola/facturas[/[id]]`, `/iberdrola/contratos[/[id]]`, `/combustible[/[id]]`,
  `/cuenta/movimientos[/[id]]`, `/cuenta/clasificar`, `/cuenta/vincular/[id]`, `/cuenta/categorias`, `/sorteos`, `/sorteos/nuevo`,
  `/sorteos/editar/[id]`, `/sorteos/[id]`, `/sorteos/abonados[/nuevo|/[id]]`, `/pdf`.
  Módulos extra: `expo-file-system`, `expo-sharing`, `expo-asset` y `react-native-webview`;
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

---

## 4. Base de datos (InsForge / Postgres)

### Tablas
- **Mercadona**: `mercadona_tickets`, `mercadona_ticket_items`, `mercadona_products`,
  `mercadona_product_aliases`, `mercadona_lines`.
- **Banca**: `bank_transactions` (con `concept`, `category_id`, `dedup_hash` unique, y
  `source`, `account_iban`, `account_name`, `external_id`), `bank_categories`,
  `bank_transaction_links`, `bank_account_balances` (instantánea diaria de saldo).
- **Iberdrola**: `iberdrola_contracts`, `iberdrola_invoices`, `iberdrola_invoice_lines`,
  `iberdrola_invoice_consumption`.
- **Combustible (Waylet)**: `waylet_tickets`, `waylet_ticket_lines`.
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
  `bank_match_tickets`, `bank_match_invoices`, `bank_suggest_category` (sugerencia de categoría por
  historial/comercio), `bank_links_validate_target` (trigger).
- Iberdrola: `iberdrola_upsert_invoice`, `iberdrola_invoice_message_ids`,
  `iberdrola_summary`, `iberdrola_price_history`.
- Waylet: `waylet_upsert_ticket`, `waylet_ticket_message_ids`, `waylet_summary`,
  `bank_match_waylet`.

### Buckets (todos privados)
`mercadona`, `bank-statements`, `iberdrola`, `waylet`.
Políticas de lectura en `storage.objects` para `mercadona`, `iberdrola` y `waylet` (owner).

### Migraciones aplicadas
`20260930082032_bank-transactions`, `20260930090015_bank-categories-and-links`,
`20260930090015`…, `20261001092559_iberdrola-invoices`,
`20261001094816_iberdrola-message-ids-obj`, `20261001133632_storage-iberdrola-select`,
`20261001134653_iberdrola-price-history`, `20261002133047_waylet-tickets`,
`20261002133222_storage-waylet-select`, `20261006071518_enablebanking-transactions`,
`20261006075208_account-balances`, `20261007120000_abonados`, `20261007130000_metodo-pago`,
`20261007140000_pagos-antiguos-efectivo`, `20261007150000_mercadona-summary-range`,
`20261007160000_bank-suggest-category`, `20261007160001_bank-suggest-category-keywords`.

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
   `bank_transaction_links.target_type ∈ {ticket, invoice, waylet}`.
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
