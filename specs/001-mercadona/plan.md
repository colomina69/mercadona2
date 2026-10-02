# Plan — Mercadona (tickets y productos)

**ID**: 001-mercadona · **Depende de**: `constitution.md`, `architecture.md`

## 1. Contexto técnico

- Ingesta: **n8n** (Gmail trigger) → **Extract from File (PDF)** → **Code (parser)** →
  **HTTP RPC** InsForge → **Storage** InsForge.
- App: **Next.js 14** App Router; lecturas por Server Components (`createInsForgeServerClient`),
  escrituras de usuario por cliente de navegador (`getInsforgeBrowser`).

## 2. Contratos

### 2.1 RPCs

- `mercadona_upsert_ticket(p_ticket jsonb, p_items jsonb) → jsonb`
  Upsert por `message_id`; borra e inserta `mercadona_ticket_items`. Devuelve `{id, message_id, pdf_key}`.
- `mercadona_ticket_message_ids() → jsonb` → `{ ids: [...] }` (para el backfill).
- `mercadona_spend_summary() → jsonb` → `{ totals, monthly[], by_store[], top_products[] }`.
- `mercadona_products(q text, lim int) → jsonb` → filas `{product_name, purchases, last_date, last_price, avg_price}`.
- `mercadona_product_history(name text) → jsonb` → puntos `{purchased_at, unit_price_eff}`.

### 2.2 Endpoints REST usados

- `POST /api/database/rpc/mercadona_upsert_ticket`
- `PUT /api/storage/buckets/mercadona/objects/{key}` (multipart, campo `file`)
- `GET /api/storage/buckets/mercadona/objects?limit=1000`

## 3. Workflows n8n

| Fichero | Trigger | Cadena |
|---|---|---|
| `n8n/mercadona-tickets-new.js` | Gmail (nuevos) | Gmail → Expand PDFs → Extract PDF → Parse Ticket → DB Upsert → Reattach PDF → Upload |
| `n8n/mercadona-tickets.js` | Manual (backfill) | Start → List ids → List objects → Get Tickets → … → Not In DB → Upsert → Not In Storage → Upload |

## 4. Estructura de la app

```
mercadona-app/src/
  app/(app)/page.tsx                 # Dashboard
  app/(app)/tickets/page.tsx         # Listado
  app/(app)/tickets/[id]/page.tsx    # Detalle + PDF + líneas + IVA
  app/(app)/productos/page.tsx       # Catálogo
  app/(app)/productos/[name]/page.tsx# Histórico de precios
  components/{TicketFilters,ProductSearch,PdfButton,AliasManager,charts}.tsx
  lib/{types,format}.ts
```

## 5. UI

- Tarjetas de resumen, `MonthlySpendChart`, `StoreSpendChart`, `TopProductsChart`, `PriceHistoryChart`.
- Tablas → tarjetas en móvil; tablas con scroll en `md+`.
- `PdfButton` descarga del bucket privado (con política de storage).

## 6. Decisiones

- Deduplicación por `message_id` (único).
- Reintentos en los nodos HTTP (`retryOnFail`, `maxTries`).
- Los IDs existentes se listan antes del backfill para evitar reprocesar.

## 7. Validación

- Comparar totales parseados con el total impreso en PDFs de muestra.
- Comprobar que reimportar no duplica.
