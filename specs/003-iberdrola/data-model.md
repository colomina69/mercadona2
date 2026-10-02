# Modelo de datos — Facturas Iberdrola

**ID**: 003-iberdrola

## 1. Entidades

### `iberdrola_contracts`
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `contract_number` | text **UNIQUE** | clave natural |
| `label` | text | p. ej. SANT LLORENC / SANT PERE |
| `cups` | text | punto de suministro |
| `supply_address`, `city` | text | dirección |
| `titular`, `nif` | text | |
| `tariff` | text | p. ej. 2.0TD |
| `market`, `plan` | text | |
| `contracted_power_punta`, `contracted_power_valle` | numeric(8,3) | kW |
| `created_at`, `updated_at` | timestamptz | |

### `iberdrola_invoices`
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | text **UNIQUE** | email |
| `contract_id` | uuid → `iberdrola_contracts(id)` | ON DELETE SET NULL |
| `contract_number` | text | redundante útil |
| `invoice_number` | text **UNIQUE** | clave de upsert |
| `issue_date`, `period_start`, `period_end`, `due_date` | date | |
| `tariff` | text | |
| `days_billed` | integer | |
| `total`, `subtotal`, `energy_amount`, `charges_amount`, `services_amount`, `tax_amount` | numeric(12,2) | |
| `consumption_kwh` | numeric(12,3) | |
| `cups` | text | |
| `pdf_key`, `pdf_url` | text | Storage |
| `raw_text` | text | crudo (inmutable) |
| `created_at`, `updated_at` | timestamptz | |

### `iberdrola_invoice_lines`
`id`, `invoice_id → iberdrola_invoices(id)` (ON DELETE CASCADE), `line_no`, `grp`
(`power|energy|charges|services|taxes`), `line_type` (p. ej. `potencia_punta`, `energia`,
`impuesto_electricidad`, `iva`), `tramo` (`punta|valle|null`), `period`, `concept`, `detail`,
`quantity`, `unit` (`kW|kWh|días|meses|%`), `unit_price` (**€/kW·día** o **€/kWh**), `days`,
`amount`, `tax_base`, `vat_rate`, `created_at`.

### `iberdrola_invoice_consumption`
`id`, `invoice_id → iberdrola_invoices(id)` (ON DELETE CASCADE), `tramo`, `kwh`.
Único `(invoice_id, tramo)`.

## 2. RLS

- Owner único (`auth.uid() = 'dfaf6414-…'`). CRUD para `authenticated` en las 4 tablas.
- `bank_transaction_links`: el trigger valida `target_type='invoice'` contra `iberdrola_invoices`.

## 3. RPCs

| RPC | Descripción |
|---|---|
| `iberdrola_upsert_invoice(p_invoice, p_lines, p_consumption)` | upsert contrato + factura, reemplaza líneas/consumo |
| `iberdrola_invoice_message_ids()` | `{ids:[...]}` para el backfill |
| `iberdrola_summary(p_contract_id, p_from, p_to)` | totales, por contrato, potencia, mensual, tramos |
| `iberdrola_price_history(p_contract_id)` | serie €/kWh y €/kW·día por factura |
| `bank_match_invoices(p_transaction_id, p_days, p_tolerance)` | candidatos de vinculación |

## 4. Almacenamiento

- Bucket **`iberdrola`** (privado). Clave: `iberdrola/<contract>/<invoice>.pdf`.
- Política `storage_objects_iberdrola_select`: `SELECT` para `authenticated` cuando
  `bucket='iberdrola'` y `auth.jwt()->>'sub'` es el propietario.
