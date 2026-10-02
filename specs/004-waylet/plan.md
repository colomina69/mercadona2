# Plan — Combustible Waylet

**ID**: 004-waylet · **Depende de**: `constitution.md`, `architecture.md`

## 1. Contexto técnico

Igual que Iberdrola, pero con un paso previo: el PDF **no viene adjunto**; se **descarga**
desde la URL del correo antes de extraer el texto.

## 2. Cadena n8n

```
Gmail trigger (from:benicolo@gmail.com + subject:Waylet)
  → Code "Extract link"       (regex de la URL del ticket; localidad del asunto)
  → HTTP "Download PDF"       (GET, responseFormat=file, outputPropertyName=data)   [onError: continue]
  → Extract from File (PDF)   (keepSource: both)                                    [onError: continue]
  → Code "Parse Waylet"       (usa $('Extract link') para messageId/localidad)
  → RPC waylet_upsert_ticket
  → Code "Reattach PDF"       (por ticket_number desde Parse)
  → HTTP "Upload to InsForge" (bucket waylet)
```

Backfill: `n8n/waylet-backfill.js` (manual): lista ids/objetos, Gmail getAll, mismo pipeline
con filtros `Not In DB` / `Not In Storage`.

Generación: `scripts/n8n-waylet-build.js` (incrusta `n8n/waylet-parser.js` como string JSON).

## 3. Parser (`n8n/waylet-parser.js`)

- Estación `(ES\s+GLEM\s+S\.?L\.?)`; dirección `(C\/|CL) …`; `(\d{5}) - (LOCALIDAD)`.
- `Fecha: dd-mm-yyyy` + `Hora: HH:MM:SS` → `purchased_at`.
- `PRODUCTO €/L <fuel> <precio>`; `LITROS n`; `IMPORTE bruto -descuento`; `Total Venta: n€`.
- `Pago Waylet <método> ****<last4>`; `N. de ticket n`; `Id: <uuid>`.
- Líneas: carburante (importe bruto) + línea de descuento (negativa).

## 4. Contratos

| RPC | Entradas | Salida |
|---|---|---|
| `waylet_upsert_ticket` | `p_ticket jsonb`, `p_lines jsonb` | `{id, ticket_number}` |
| `waylet_ticket_message_ids` | — | `{ids:[…]}` |
| `waylet_summary` | `p_from date`, `p_to date` | `{totals, monthly[], by_station[], by_fuel[]}` |
| `bank_match_waylet` | `p_transaction_id uuid`, `p_days`, `p_tolerance` | candidatos |

Bucket `waylet` (privado) + política de lectura del propietario.

## 5. Estructura de la app

```
src/app/(app)/combustible/page.tsx        # Lista + totales + gráficas + filtros
src/app/(app)/combustible/[id]/page.tsx   # Detalle + líneas + PDF
src/components/FuelFilters.tsx
src/app/(app)/movimientos/[id]/FuelLinker.tsx
src/components/charts.tsx                 # MonthlyFuelChart + PriceLineChart (€/L)
```

## 6. Decisiones

- Dedup por `ticket_number` (único) — evita duplicados al reenviar el correo.
- `target_type='waylet'` añadido al `CHECK` de `bank_transaction_links` y al trigger de validación.
- Sin `onError` en el trigger: si no hay enlace, no se genera item y no pasa nada.

## 7. Validación

- Parser contra el PDF de muestra (todos los campos correctos; total = bruto − descuento).
- RPC real: upsert + `waylet_summary` (€/L bruto 1,9391; pagado 1,8126).
- `npm run build` sin errores.
