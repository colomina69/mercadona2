# Modelo de datos — Combustible Waylet

**ID**: 004-waylet

## 1. Entidades

### `waylet_tickets`
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | text | id del email (indexado) |
| `waylet_id` | text | UUID del ticket (`Id: …`) |
| `ticket_number` | text **UNIQUE** | `N. de ticket` (clave de upsert) |
| `purchased_at` | timestamptz | fecha + hora |
| `station_name` | text | `ES GLEM SL` |
| `address` | text | dirección de la estación |
| `postal_code`, `locality` | text | CP y localidad |
| `fuel_type` | text | `Diesel e+`, `Gasolina 95`, … |
| `liters` | numeric(10,3) | litros |
| `unit_price` | numeric(10,4) | **€/L** |
| `gross_amount` | numeric(12,2) | importe bruto |
| `discount_amount` | numeric(12,2) | descuento |
| `total` | numeric(12,2) | importe pagado |
| `payment_method`, `card_last4` | text | pago |
| `vehicle_plate` | text | matrícula (nullable) |
| `points` | numeric(12,3) | puntos Waylet (nullable) |
| `pdf_key`, `pdf_url` | text | Storage |
| `raw_text` | text | crudo (inmutable) |
| `created_at`, `updated_at` | timestamptz | |

### `waylet_ticket_lines`
`id`, `ticket_id → waylet_tickets(id)` (ON DELETE CASCADE), `line_no`, `product_name`,
`unit_price`, `amount`, `created_at`.

## 2. RLS

Owner único (`auth.uid() = 'dfaf6414-…'`), CRUD para `authenticated` en ambas tablas.

## 3. RPCs

| RPC | Descripción |
|---|---|
| `waylet_upsert_ticket(p_ticket, p_lines)` | upsert por `ticket_number`, reemplaza líneas |
| `waylet_ticket_message_ids()` | `{ids:[…]}` para el backfill |
| `waylet_summary(p_from, p_to)` | totales (litros, €, **€/L**), mensual, por estación, por carburante |
| `bank_match_waylet(p_transaction_id, p_days=7, p_tolerance=0.02)` | candidatos de vinculación |

## 4. Enlaces

- `bank_transaction_links.target_type` amplía su `CHECK` a `('ticket','invoice','waylet')`.
- El trigger `bank_links_validate_target` valida `target_id` contra `waylet_tickets`.

## 5. Almacenamiento

- Bucket **`waylet`** (privado). Clave: `waylet/<ticket_number>.pdf`.
- Política `storage_objects_waylet_select` (SELECT del propietario).
