# Tareas — Movimientos bancarios (banca)

**ID**: 002-banca · Estado: `[x]` hecho

## Fase 1 — Backend
- [x] T001 Migración `bank-transactions`: tabla, índices, RLS, RPC `bank_upsert_transactions`, `bank_summary`.
- [x] T002 Bucket privado `bank-statements`.
- [x] T003 Migración `bank-categories-and-links`: `bank_categories` + semilla, `concept`/`category_id`,
  política `UPDATE`, grants por columna, `bank_transaction_links` + trigger de validación.
- [x] T004 RPC `bank_match_tickets`.
- [x] T005 `bank_summary.by_category`.

## Fase 2 — Ingesta (n8n)
- [x] T006 Workflow webhook `bank-statements` con token (`Check Token`).
- [x] T007 Parser Latin‑1 + `md5(raw_line)` (hash en SQL) + upsert.
- [x] T008 Lectura de binario con `getBinaryDataBuffer` (binaryMode separate) y `onError: continue` en upload.
- [x] T009 Publicación del workflow y prueba end‑to‑end (insert/skip/401).

## Fase 3 — Aplicación
- [x] T010 Server action `uploadBankFileAction` (proxy al webhook con token server-only).
- [x] T011 Variable `N8N_BANK_WEBHOOK_URL` / `N8N_BANK_WEBHOOK_TOKEN` en `.env.local` y Vercel.
- [x] T012 `/movimientos` (resumen, gráficas, filtros, tabla/tarjetas, subida).
- [x] T013 `/movimientos/[id]` con `TransactionEditor` (concepto + categoría + crear categoría).
- [x] T014 `TicketLinker` (sugerencias + búsqueda + vincular/desvincular).
- [x] T015 `InvoiceLinker` (facturas Iberdrola).
- [x] T016 `/categorias` + `CategoryManager` (CRUD).
- [x] T017 Filtros por categoría/“sin categoría” y búsqueda.

## Fase 4 — Calidad
- [x] T018 `npm run build` sin errores.
- [x] T019 Responsive (tarjetas en móvil) y área táctil.
- [x] T020 Verificación: 1ª subida `inserted`, 2ª `skipped`; token 401; columnas financieras protegidas.
