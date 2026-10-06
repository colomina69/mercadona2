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
  `/categorias`, `/facturas`, `/facturas/[id]`, `/contratos`, `/contratos/[id]`,
  `/combustible`, `/combustible/[id]`, `/login`.

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

### RPCs
- Mercadona: `mercadona_upsert_ticket`, `mercadona_ticket_message_ids`,
  `mercadona_spend_summary`, `mercadona_products`, `mercadona_product_history`.
- Banca: `bank_upsert_transactions`, `bank_upsert_account_balances`, `bank_summary`,
  `bank_match_tickets`, `bank_match_invoices`, `bank_links_validate_target` (trigger).
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
`20261006075208_account-balances`.

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
   `bank_transaction_links.target_type ∈ {ticket, invoice}`.

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

---

## 8. Comandos útiles

```bash
# App
cd mercadona-app && npm run dev          # http://localhost:4001
npm run build

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
