# Tareas — Facturas Iberdrola

**ID**: 003-iberdrola · Estado: `[x]` hecho

## Fase 1 — Backend
- [x] T001 Migración `iberdrola-invoices`: `iberdrola_contracts`, `iberdrola_invoices`,
  `iberdrola_invoice_lines`, `iberdrola_invoice_consumption`.
- [x] T002 RLS por owner + grants en las 4 tablas.
- [x] T003 RPC `iberdrola_upsert_invoice` (contrato + factura + líneas + consumo).
- [x] T004 RPC `iberdrola_summary` (totales, por contrato, potencia, mensual, tramos).
- [x] T005 RPC `bank_match_invoices` + validación `target_type='invoice'` en el trigger.
- [x] T006 Bucket privado `iberdrola`.
- [x] T007 RPC `iberdrola_invoice_message_ids` → `{ids:[...]}`.
- [x] T008 Política de storage `storage_objects_iberdrola_select`.
- [x] T009 RPC `iberdrola_price_history`.

## Fase 2 — Parser
- [x] T010 Módulo `n8n/iberdrola-parser.js` (cabecera, líneas por fórmulas, consumo por tramo).
- [x] T011 Validación contra 29 PDFs locales (29/29; tramos 29/29).
- [x] T012 Generador `scripts/n8n-iberdrola-build.js` (incrusta el parser en los workflows).

## Fase 3 — Ingesta (n8n)
- [x] T013 Workflow trigger `iberdrola-invoices` (Gmail → … → upsert → upload).
- [x] T014 Workflow `iberdrola-backfill` (manual, sin duplicar).
- [x] T015 `onError: continue` en la extracción (ignorar PDFs no‑factura).
- [x] T016 Backfill ejecutado: **113 facturas / 2 contratos / 533 líneas**.

## Fase 4 — Aplicación
- [x] T017 `PdfButton` con prop `bucket`.
- [x] T018 `/facturas` (agrupada por contrato, secciones plegables con totales).
- [x] T019 `/facturas/[id]` (desglose por grupos + consumo por tramo + PDF).
- [x] T020 `/contratos` y `/contratos/[id]` (totales y evolución).
- [x] T021 Gráficas de precio €/kWh y €/kW·día por contrato (`PriceLineChart`).
- [x] T022 `InvoiceLinker` en `/movimientos/[id]`.

## Fase 5 — Correcciones
- [x] T023 Message-ids como objeto (evita cortar la cadena del backfill).
- [x] T024 Política de storage del bucket `iberdrola` (arregla “object not found”).
- [x] T025 Gráficas con props serializables (evita el error de funciones en Client Components).

## Fase 6 — Calidad
- [x] T026 `npm run build` sin errores.
- [x] T027 Responsive + navegación agrupada por fuente.
