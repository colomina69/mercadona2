# Especificación — Movimientos bancarios (banca)

**ID**: 002-banca · **Estado**: implementado

## 1. Resumen

Ingesta del **extracto bancario** (TXT separado por `|`) subido desde la propia app,
almacenamiento idempotente de los movimientos, edición de concepto, categorización por
tipos definidos por el usuario y **vinculación** con tickets de Mercadona y facturas de
Iberdrola.

## 2. Historias de usuario

- **HU-1**: Como propietario, quiero subir el `.txt` del banco desde `/movimientos` y que
  se importen sin duplicarse.
- **HU-2**: Como propietario, quiero editar el **concepto** de un movimiento y asignarle una
  **categoría** (gasto/ingreso) que yo defino.
- **HU-3**: Como propietario, quiero **vincular** un movimiento con el ticket de Mercadona o
  la factura de Iberdrola que le corresponde, con sugerencias automáticas por importe y fecha.
- **HU-4**: Como propietario, quiero ver ingresos/gastos, saldo y gasto por categoría.

## 3. Requisitos funcionales

- **FR-001**: `/movimientos` incluye un formulario de subida; un **server action** reenvía el
  archivo al webhook de n8n con `X-Webhook-Token` (token server-only).
- **FR-002**: El webhook valida el token (rechaza con `401` si falta o es incorrecto).
- **FR-003**: El parser decodifica **Latin‑1**, soporta CRLF, requiere 7 campos
  (fecha, concepto, fecha valor, importe, saldo, CIF, referencia) y calcula un `dedup_hash`.
- **FR-004**: La RPC `bank_upsert_transactions(p_rows, p_source_file, p_raw_key)` inserta con
  `ON CONFLICT (dedup_hash) DO NOTHING` y devuelve `{inserted, skipped, total}`.
- **FR-005**: El `.txt` original se guarda en el bucket privado `bank-statements` (mejor esfuerzo).
- **FR-006**: Cada movimiento tiene un `concept` editable (si es NULL se muestra la descripción
  original, que es inmutable).
- **FR-007**: El usuario puede crear/editar/borrar **categorías** (`bank_categories`) con
  `kind ∈ {expense, income}`.
- **FR-008**: Se puede asignar una categoría a un movimiento; `/movimientos` filtra por
  categoría y por “sin categoría”.
- **FR-009**: Vínculos en `bank_transaction_links` (`target_type ∈ {ticket, invoice}`), con
  sugerencias: `bank_match_tickets` y `bank_match_invoices` (importe ± tolerancia y fecha ± días).
- **FR-010**: `bank_summary(from,to)` devuelve totales, serie mensual y desglose por categoría.

## 4. Criterios de aceptación

- **SC-1**: Subir un `.txt` nuevo inserta sus movimientos; reintentar deja `skipped > 0`.
- **SC-2**: Solo se pueden editar `concept` y `category_id` (importe/saldo/fechas no son editables).
- **SC-3**: Un movimiento puede vincularse a uno o varios tickets/facturas y desvincularse.
- **SC-4**: El webhook sin token responde `401 {"ok":false,"error":"unauthorized"}`.
- **SC-5**: El importe registrado coincide con el del fichero (incluido el signo).

## 5. Fuera de alcance

- Conexión directa a la API del banco (solo fichero).
- Conciliación bancaria automática 100% (solo sugerencias).
- Importación de extractos de otros formatos de banco.

## 6. Supuestos

- El fichero usa `|` como separador y formato numérico español o con punto decimal.
- Es una única cuenta por extracto (no hay campo de cuenta).
