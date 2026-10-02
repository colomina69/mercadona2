# Modelo de datos — Mercadona

**ID**: 001-mercadona

## 1. Entidades

### `mercadona_tickets` (cabecera)
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `message_id` | text **UNIQUE** | id del email; clave de idempotencia |
| `ticket_number` | text | nº de factura simplificada |
| `purchased_at` | timestamptz | fecha/hora de compra |
| `store_name`, `store_cif`, `store_address`, `store_postal_code`, `store_city`, `store_phone` | text | tienda |
| `operator_code`, `entry_time`, `exit_time` | text | caja/tiempos |
| `item_count` | integer | nº de líneas |
| `subtotal`, `total` | numeric | importes |
| `payment_method`, `card_last4`, `nc`, `auth_code` | text | pago |
| `vat_summary` | jsonb | desglose de IVA |
| `pdf_key`, `pdf_url` | text | referencia al PDF en Storage |
| `raw_text` | text | texto crudo del PDF (inmutable) |
| `created_at`, `updated_at` | timestamptz | sistema |

### `mercadona_ticket_items` (líneas)
`id`, `ticket_id → mercadona_tickets(id)`, `line_no`, `product_name`, `quantity`, `unit`,
`unit_price`, `weight_kg`, `amount`, `vat_rate`, `created_at`.

### `mercadona_products` / `mercadona_product_aliases`
- `mercadona_products`: `id`, `name` (UNIQUE lógico), `created_at`.
- `mercadona_product_aliases`: `id`, `raw_name`, `product_id → mercadona_products(id)`, `created_at`.

### `mercadona_lines` (vista materializada de análisis)
`id`, `ticket_id`, `purchased_at`, `store_name`, `store_city`, `raw_name`, `product_name`,
`quantity`, `unit`, `unit_price`, `weight_kg`, `amount`, `unit_price_eff`, `price_kg`.

## 2. RLS

- Propietario único: `auth.uid() = 'dfaf6414-958a-4768-9d92-a57493181524'`.
- `mercadona_tickets`, `mercadona_ticket_items`, `mercadona_lines`: `SELECT` para `authenticated`.
- `mercadona_products` / `mercadona_product_aliases`: `SELECT/INSERT/UPDATE/DELETE` para
  `authenticated` (edición de catálogo y alias desde la app).

## 3. RPCs

| RPC | Entradas | Salida |
|---|---|---|
| `mercadona_upsert_ticket` | `p_ticket jsonb`, `p_items jsonb` | `{id, message_id, pdf_key}` |
| `mercadona_ticket_message_ids` | — | `{ids:[...]}` |
| `mercadona_spend_summary` | — | `{totals, monthly[], by_store[], top_products[]}` |
| `mercadona_products` | `q text`, `lim int` | filas de producto agregadas |
| `mercadona_product_history` | `name text` | serie `{purchased_at, unit_price_eff}` |

## 4. Almacenamiento

- Bucket **`mercadona`** (privado).
- Clave: `mercadona/<messageId>/<nombre>.pdf`.
- Política `storage.objects`: `SELECT` para `authenticated` cuando `bucket='mercadona'` y el
  `sub` del JWT es el propietario.
