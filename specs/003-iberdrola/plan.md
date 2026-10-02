# Plan — Facturas Iberdrola (contratos y precios)

**ID**: 003-iberdrola · **Depende de**: `constitution.md`, `architecture.md`

## 1. Contexto técnico

Mismo pipeline que Mercadona (Gmail → Extract PDF → Code → RPC → Storage) más un
**parser específico** de Iberdrola y un workflow de **backfill** manual.

## 2. Migraciones

| Migración | Contenido |
|---|---|
| `*_iberdrola-invoices.sql` | 4 tablas, RLS/grants, `iberdrola_upsert_invoice`, `iberdrola_summary`, `bank_match_invoices`, trigger de validación, bucket |
| `*_iberdrola-message-ids-obj.sql` | `iberdrola_invoice_message_ids` devuelve `{ids:[...]}` |
| `*_storage-iberdrola-select.sql` | política `storage.objects` para descargar PDFs del bucket `iberdrola` |
| `*_iberdrola-price-history.sql` | RPC `iberdrola_price_history` |

## 3. Contratos

### 3.1 RPCs
| RPC | Entradas | Salida |
|---|---|---|
| `iberdrola_upsert_invoice` | `p_invoice jsonb`, `p_lines jsonb`, `p_consumption jsonb` | `{id, contract_id, invoice_number}` |
| `iberdrola_invoice_message_ids` | — | `{ids:[...]}` |
| `iberdrola_summary` | `p_contract_id uuid`, `p_from date`, `p_to date` | `{totals, by_contract[], power_by_contract[], monthly[], consumption_by_tramo[]}` |
| `iberdrola_price_history` | `p_contract_id uuid` | puntos `{issue_date, energy_eur_kwh, power_punta, power_valle}` |
| `bank_match_invoices` | `p_transaction_id uuid`, `p_days int`, `p_tolerance numeric` | candidatos de factura |

### 3.2 Bucket
- `iberdrola` (privado). Clave: `iberdrola/<contract>/<invoice>.pdf`.
- Política de storage `SELECT` para el propietario (idéntica a la de `mercadona`).

## 4. Workflows n8n

| Fichero | Trigger | Cadena |
|---|---|---|
| `n8n/iberdrola-invoices.js` | Gmail (nuevas) | Gmail → Expand PDFs → Extract PDF Text → Parse Iberdrola → DB Upsert → Reattach → Upload |
| `n8n/iberdrola-backfill.js` | Manual | Start → List ids → List objects → Get Invoices → … → Not In DB → Upsert → Not In Storage → Upload |

El parser vive en `n8n/iberdrola-parser.js` (módulo compartido) y se **incrusta** en los
workflows con `scripts/n8n-iberdrola-build.js` (evita el problema de escapes del template).

## 5. Parser (resumen de anclas)

- `Nº FACTURA:\s*(\d{17})`, `Nº DE CONTRATO:\s*(\d+)`
- `PERIODO DE FACTURACIÓN:` `dd/mm/yyyy - dd/mm/yyyy`
- `FECHA DE EMISIÓN:` (`22 de febrero de 2024` → ISO), `FECHA PREVISTA DE COBRO:`
- `TOTAL` (línea siguiente), `ENERGÍA\.{3,}`, `CARGOS NORMATIVOS`, `SERVICIOS…`, `IVA…`
- `Potencia punta:`/`valle`, CUPS (`ES xxxx…`), `(\d\.\dTD)`, NIF, `Titular`, dirección
- Líneas por **fórmulas** globales (no por columnas), con `String`/`RegExp` puros (sin `require`).
- Normalización de ligaduras (`ﬁ`→`fi`) y decodificación UTF‑8.

## 6. Estructura de la app

```
src/app/(app)/facturas/page.tsx            # Agrupado por contrato + gráficas de precio
src/app/(app)/facturas/[id]/page.tsx       # Detalle con desglose y consumo por tramo
src/app/(app)/contratos/page.tsx           # Comparativa por contrato
src/app/(app)/contratos/[id]/page.tsx      # Contrato + evolución de precios
src/components/{InvoiceFilters,PdfButton,charts}.tsx
src/app/(app)/movimientos/[id]/InvoiceLinker.tsx
```

## 7. Decisiones

- Modelo **específico de Iberdrola** (a petición): `iberdrola_*`.
- Upsert por `invoice_number` (dedup) y `message_id` (único).
- Importes de línea **derivados de la fórmula**; el **total** de cabecera es el autoritativo.
- Gráficas con props **serializables** (`decimals`, `suffix`), no funciones (Server → Client).

## 8. Validación

- Parser: 29/29 PDFs; consumos por tramo 29/29; suma de líneas ≈ total.
- RPC real de prueba con una factura; `iberdrola_summary` coherente.
- Backfill ejecutado: 113 facturas / 2 contratos.
