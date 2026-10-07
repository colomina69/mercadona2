# Arquitectura del sistema (visión general)

> Transcripción del sistema completo. Detalle por funcionalidad en `specs/001..003`.

## 1. Componentes

```
                    ┌──────────────────────────────┐
  Gmail (tickets)   │        n8n (benicolo.com)    │
  Gmail (facturas) ─▶  workflows de ingesta        │
  navegador (TXT) ─▶   (Gmail trigger / webhook)   │
                    └──────────────┬───────────────┘
                                   │ HTTP (API key InsForge)
                                   ▼
                    ┌──────────────────────────────┐
                    │     InsForge (BaaS)          │
                    │  Postgres + PostgREST (RLS)  │
                    │  Storage (buckets privados)  │
                    │  Auth                        │
                    └──────────────┬───────────────┘
                                   │ @insforge/sdk
                                   ▼
                    ┌──────────────────────────────┐
                    │  Next.js 14 (App Router)     │
                    │  Server Components + Client  │
                    │  Hosting: Vercel             │
                    └──────────────────────────────┘
```

## 2. Flujos de datos

### A. Ingesta por email (Mercadona e Iberdrola)

1. **n8n** dispara con un **Gmail trigger** (`from:` del remitente, `has:attachment filename:pdf`).
2. Descarga los PDFs adjuntos (`downloadAttachments`), los expande a binarios.
3. **Extract from File** obtiene el texto del PDF.
4. Un nodo **Code** parsea el texto (regex) a cabecera + líneas.
5. **HTTP Request** a una **RPC** de InsForge (`*_upsert_*`) con la credencial `httpHeaderAuth`
   “InsForge” (API key). La RPC es idempotente.
6. Se vuelve a adjuntar el PDF y se sube a un **bucket** de InsForge (privado).

### B. Ingesta manual de extracto bancario

1. En la app, `/movimientos` muestra un formulario; un **server action** reenvía el `.txt`
   al **webhook** de n8n con cabecera `X-Webhook-Token`.
2. n8n valida el token, decodifica Latin‑1, parsea las líneas y llama a la RPC
   `bank_upsert_transactions`; sube el `.txt` al bucket `bank-statements`.

### C. Aplicación (lectura y edición)

- Los **Server Components** leen con `createInsForgeServerClient()` (sesión por cookies).
- Las **escrituras del usuario** (editar concepto, categoría, vínculos) usan el
  **cliente de navegador** `getInsforgeBrowser()`; RLS garantiza el aislamiento.
- `middleware.ts` protege las rutas de `(app)` y redirige a `/login` si no hay sesión.

## 3. Superficie de datos (resumen)

| Dominio | Tablas | Bucket |
|---|---|---|
| Mercadona | `mercadona_tickets`, `mercadona_ticket_items`, `mercadona_products`, `mercadona_product_aliases`, `mercadona_lines` | `mercadona` |
| Bancos | `bank_transactions`, `bank_categories`, `bank_transaction_links`, `bank_account_balances` | `bank-statements` |
| Iberdrola | `iberdrola_contracts`, `iberdrola_invoices`, `iberdrola_invoice_lines`, `iberdrola_invoice_consumption` | `iberdrola` |
| Combustible | `waylet_tickets`, `waylet_ticket_lines` | `waylet` |
| Sorteos | `sorteos`, `pagos`, `push_tokens` | — |

Los **vínculos** movimiento↔ticket↔factura↔repostaje se modelan en `bank_transaction_links`
(`target_type ∈ {ticket, invoice, waylet}`), con validación de existencia mediante trigger.

## 4. Cliente móvil (Expo)

- App **`mobile/`**: Expo SDK 57 + Expo Router (rutas en `mobile/src/app/`).
- Accede a InsForge con **`createAdminClient`** (API key admin, **sin login**), porque las tablas
  financieras tienen RLS de propietario. La clave vive en `mobile/.env` (gitignored).
- Reutiliza las mismas tablas y RPCs que el frontend web; secciones **Mercadona, Iberdrola,
  Combustible, Cuenta y Sorteos**.
- `metro.config.js` aliasa el builtin `crypto` a un shim (`src/shims/crypto.js`) por una importación
  dinámica del SDK en su ruta Node.

## 5. Rutas de la aplicación web

| Ruta | Descripción |
|---|---|
| `/` | Portada tipo hub con botones a los apartados (móvil) |
| `/mercadona` | Dashboard Mercadona (gasto, tiendas, top productos) |
| `/tickets`, `/tickets/[id]` | Listado y detalle de tickets (+PDF) |
| `/productos`, `/productos/[name]` | Catálogo y evolución de precios |
| `/movimientos`, `/movimientos/[id]` | Movimientos bancarios, edición, vínculos |
| `/categorias` | Tipos de gasto/ingreso |
| `/facturas`, `/facturas/[id]` | Facturas Iberdrola agrupadas por contrato |
| `/contratos`, `/contratos/[id]` | Contratos, totales y evolución de precios |
| `/combustible`, `/combustible/[id]` | Repostajes Waylet (+PDF) |
| `/login` | Autenticación email/contraseña |

**Navegación**: la portada `/` es un hub de botones hacia las cuatro secciones. Cada sección
muestra un **menú contextual de pills** (`SectionNav`, detecta la sección por la ruta) con sus
sub-páginas, visible también en las páginas de detalle. En la cabecera, el botón **Inicio**
(enlace a `/`) está disponible desde cualquier página. No hay menú global.

## 6. Integraciones externas

- **Gmail** (n8n): `ticket_digital@mail.mercadona.com`, `clientes@clientesiberdrola.es`.
- **InsForge API** (`https://insforge.benicolo.com`): PostgREST + Storage + Auth.
- **n8n** (`https://n8n.benicolo.com`): automatizaciones publicadas.
- **Vercel**: hosting del frontend (proyecto `insforge`).

## 7. Entornos

- **Producción app web**: `https://insforge-mu.vercel.app` (Vercel, proyecto `insforge`).
- **Backend**: proyecto InsForge `oss-project` en `https://insforge.benicolo.com`.
- **Desarrollo web**: `next dev -p 4001`, claves en `mercadona-app/.env.local`.
- **App móvil**: `cd mobile && npx expo start` (Expo Go); claves en `mobile/.env`.
