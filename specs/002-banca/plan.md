# Plan — Movimientos bancarios (banca)

**ID**: 002-banca · **Depende de**: `constitution.md`, `architecture.md`

## 1. Contexto técnico

- Ingesta vía **webhook n8n** protegido por token, llamado desde un **server action**
  de Next.js (evita CORS y no expone el token al navegador).
- Escrituras del usuario (concepto, categoría, vínculos) con el **cliente de navegador** y RLS.

## 2. Modelo y migraciones

- `migrations/*_bank-transactions.sql`: `bank_transactions`, índices, RLS, `bank_upsert_transactions`, `bank_summary`, bucket `bank-statements`.
- `migrations/*_bank-categories-and-links.sql`: `bank_categories`, `bank_transaction_links`,
  columnas `concept`/`category_id`, política de `UPDATE`, grants por columnas, `bank_match_tickets`,
  validación de `target_type`, `bank_summary.by_category`.
- `migrations/*_iberdrola-*.sql`: `bank_match_invoices` y validación de `target_type='invoice'`.

## 3. Contratos

### 3.1 RPCs
| RPC | Entradas | Salida |
|---|---|---|
| `bank_upsert_transactions` | `p_rows jsonb`, `p_source_file text`, `p_raw_key text` | `{inserted, skipped, total}` |
| `bank_summary` | `p_from date`, `p_to date` | `{totals, monthly[], by_category[]}` |
| `bank_match_tickets` | `p_transaction_id uuid`, `p_days int`, `p_tolerance numeric` | candidatos de ticket |
| `bank_match_invoices` | `p_transaction_id uuid`, `p_days int`, `p_tolerance numeric` | candidatos de factura |

### 3.2 Webhook n8n
- `POST https://n8n.benicolo.com/webhook/bank-statements`
- Cabecera `X-Webhook-Token` (secreto compartido).
- Cuerpo `multipart/form-data` campo `file`.

## 4. Workflow n8n (`n8n/bank-statements.js`)

```
Webhook → Check Token (IF)
  ├─ false → Respond 401
  └─ true  → Parse TXT (Code, Latin-1, decodifica binario con helpers)
             → Upload TXT (bucket bank-statements)
             → DB Upsert (bank_upsert_transactions)
             → Respond {inserted, skipped, total}
```
> Nota: el workflow usa `binaryMode: separate`, por lo que el binario se lee con
> `this.helpers.getBinaryDataBuffer(...)`.

## 5. Estructura de la app

```
src/app/(app)/movimientos/page.tsx            # Lista + subida + resumen + filtros
src/app/(app)/movimientos/UploadForm.tsx      # Formulario (cliente) → server action
src/app/(app)/movimientos/[id]/page.tsx       # Detalle: editar + vincular tickets/facturas
src/app/(app)/movimientos/[id]/TransactionEditor.tsx
src/app/(app)/movimientos/[id]/TicketLinker.tsx
src/app/(app)/movimientos/[id]/InvoiceLinker.tsx
src/app/(app)/categorias/page.tsx             # CRUD categorías
src/components/{BankFilters,CategoryManager}.tsx
src/app/actions.ts                            # uploadBankFileAction
```

## 6. Decisiones

- `dedup_hash = md5(raw_line)` (calculado en SQL) para idempotencia.
- Protección de columnas: `REVOKE UPDATE` global y `GRANT UPDATE (concept, category_id)` a `authenticated`.
- `X-Webhook-Token` gestionado como **server-only** (`.env.local`/Vercel), nunca `NEXT_PUBLIC_`.

## 7. Validación

- Ciclo: subida → `inserted>0` → 2ª subida → `skipped>0`.
- Webhook sin token → `401`.
- `UPDATE` de una columna financiera rechazado por privilegios.
