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
| Bancos | `bank_transactions`, `bank_categories`, `bank_transaction_links` | `bank-statements` |
| Iberdrola | `iberdrola_contracts`, `iberdrola_invoices`, `iberdrola_invoice_lines`, `iberdrola_invoice_consumption` | `iberdrola` |

Los **vínculos** movimiento↔ticket↔factura se modelan en `bank_transaction_links`
(`target_type ∈ {ticket, invoice}`), con validación de existencia mediante trigger.

## 4. Rutas de la aplicación

| Ruta | Descripción |
|---|---|
| `/` | Dashboard Mercadona (gasto, tiendas, top productos) |
| `/tickets`, `/tickets/[id]` | Listado y detalle de tickets (+PDF) |
| `/productos`, `/productos/[name]` | Catálogo y evolución de precios |
| `/movimientos`, `/movimientos/[id]` | Movimientos bancarios, edición, vínculos |
| `/categorias` | Tipos de gasto/ingreso |
| `/facturas`, `/facturas/[id]` | Facturas Iberdrola agrupadas por contrato |
| `/contratos`, `/contratos/[id]` | Contratos, totales y evolución de precios |
| `/login` | Autenticación email/contraseña |

## 5. Integraciones externas

- **Gmail** (n8n): `ticket_digital@mail.mercadona.com`, `clientes@clientesiberdrola.es`.
- **InsForge API** (`https://insforge.benicolo.com`): PostgREST + Storage + Auth.
- **n8n** (`https://n8n.benicolo.com`): automatizaciones publicadas.
- **Vercel**: hosting del frontend (proyecto `insforge`).

## 6. Entornos

- **Producción app**: `https://insforge-mu.vercel.app` (Vercel, proyecto `insforge`).
- **Backend**: proyecto InsForge `oss-project` en `https://insforge.benicolo.com`.
- **Desarrollo local**: `next dev -p 4001`, claves en `.env.local`.
