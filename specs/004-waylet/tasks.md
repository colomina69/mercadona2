# Tareas — Combustible Waylet

**ID**: 004-waylet · Estado: `[x]` hecho

## Fase 1 — Backend
- [x] T001 Migración `waylet-tickets`: `waylet_tickets` + `waylet_ticket_lines`.
- [x] T002 RLS owner + grants.
- [x] T003 RPC `waylet_upsert_ticket` (upsert por `ticket_number`, reemplazo de líneas).
- [x] T004 RPC `waylet_ticket_message_ids` → `{ids:[…]}`.
- [x] T005 RPC `waylet_summary` (litros, €, €/L, mensual, estación, carburante).
- [x] T006 `bank_match_waylet` + `target_type='waylet'` en el CHECK y en el trigger.
- [x] T007 Bucket privado `waylet` + política `storage_objects_waylet_select`.

## Fase 2 — Parser
- [x] T008 `n8n/waylet-parser.js` (cabecera, importes, líneas).
- [x] T009 Validación contra el PDF de muestra (todos los campos; total = bruto − descuento).

## Fase 3 — Ingesta (n8n)
- [x] T010 Generador `scripts/n8n-waylet-build.js` (incrusta el parser).
- [x] T011 Workflow trigger `waylet-tickets`: Gmail → Extract link → Download PDF → Extract → Parse → Upsert → Upload.
- [x] T012 Workflow `waylet-backfill` (manual, sin duplicar).
- [x] T013 Publicado el trigger.

## Fase 4 — Aplicación
- [x] T014 Tipos (`WayletTicket`, `WayletLine`, `WayletSummary`, `WayletCandidate`).
- [x] T015 Helpers `liters()` / `eurPerL()`.
- [x] T016 `MonthlyFuelChart` y reutilización de `PriceLineChart` (€/L).
- [x] T017 `/combustible` (totales, gráficas, filtros, tabla/tarjetas).
- [x] T018 `/combustible/[id]` (líneas + datos + PDF).
- [x] T019 Menú grupo **Combustible**.
- [x] T020 `FuelLinker` en `/movimientos/[id]`.

## Fase 5 — Ingesta real
- [x] T021 Asignar credencial **InsForge** a los nodos HTTP en n8n.
- [x] T022 Ejecutar el **backfill** y verificar (8 tickets, 12 líneas, 282,39 L, 444,55 €; 7/8 emparejan con su cargo bancario).
