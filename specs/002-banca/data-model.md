# Modelo de datos — Movimientos bancarios (banca)

**ID**: 002-banca

## 1. Entidades

### `bank_transactions`
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_date` | date | fecha operación |
| `value_date` | date | fecha valor |
| `description` | text | concepto **original** (inmutable) |
| `concept` | text | concepto **editable** (si NULL se usa `description`) |
| `amount` | numeric | importe (con signo) |
| `balance` | numeric | saldo |
| `counterparty_tax_id` | text | CIF/emisor |
| `reference` | text | referencia |
| `raw_line` | text | línea original cruda |
| `source_file` | text | nombre del fichero |
| `raw_key` | text | clave del `.txt` en Storage |
| `dedup_hash` | text **UNIQUE** | `md5(raw_line)` |
| `category_id` | uuid → `bank_categories(id)` | ON DELETE SET NULL |
| `created_at`, `updated_at` | timestamptz | |

Índices: unique(`dedup_hash`), `operation_date` desc, `amount`, `category_id`.

### `bank_categories`
`id` uuid PK, `name` text UNIQUE, `kind` text (`expense`|`income`), `color` text,
`sort_order` int, `created_at`, `updated_at`. Semilla inicial: 9 gastos + 3 ingresos.

### `bank_transaction_links`
`id` uuid PK, `transaction_id` uuid → `bank_transactions(id)` (ON DELETE CASCADE),
`target_type` text (`ticket`|`invoice`), `target_id` uuid, `created_at`, `updated_at`.
Único `(transaction_id, target_type, target_id)`.

Trigger `bank_links_validate_target` (SECURITY DEFINER): valida que `target_id` exista en
`mercadona_tickets` (ticket) o `iberdrola_invoices` (invoice).

## 2. RLS y privilegios

- `bank_transactions` (SELECT por owner) + `UPDATE` del owner limitado por columnas:
  `REVOKE UPDATE` y `GRANT UPDATE (concept, category_id)` a `authenticated`.
- `bank_categories` y `bank_transaction_links`: RLS CRUD por owner.
- Owner: `auth.uid() = 'dfaf6414-958a-4768-9d92-a57493181524'`.

## 3. RPCs

| RPC | Descripción |
|---|---|
| `bank_upsert_transactions(p_rows, p_source_file, p_raw_key)` | alta idempotente por `dedup_hash` |
| `bank_summary(p_from, p_to)` | totales + mensual + por categoría |
| `bank_match_tickets(p_transaction_id, p_days=3, p_tolerance=0.02)` | candidatos de ticket |
| `bank_match_invoices(p_transaction_id, p_days=7, p_tolerance=0.02)` | candidatos de factura |

## 4. Almacenamiento

- Bucket **`bank-statements`** (privado). Clave: `statements/<timestamp>-<nombre>.txt`.
- No se requiere política de lectura en la app (no se descarga el TXT desde el navegador).
