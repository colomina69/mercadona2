# Tareas — Mercadona

**ID**: 001-mercadona · Estado: `[x]` hecho

## Fase 1 — Backend
- [x] T001 Crear tablas `mercadona_tickets`, `mercadona_ticket_items`, `mercadona_products`,
  `mercadona_product_aliases`, `mercadona_lines`.
- [x] T002 RLS de propietario + `GRANT` correspondientes.
- [x] T003 RPC `mercadona_upsert_ticket` (upsert por `message_id`, reemplazo de líneas).
- [x] T004 RPC `mercadona_ticket_message_ids`.
- [x] T005 RPC `mercadona_spend_summary`.
- [x] T006 RPC `mercadona_products` y `mercadona_product_history`.
- [x] T007 Bucket privado `mercadona` + política de storage `SELECT`.

## Fase 2 — Ingesta (n8n)
- [x] T008 Workflow trigger `mercadona-tickets-new`: Gmail → PDF → parse → RPC → upload.
- [x] T009 Workflow backfill `mercadona-tickets`: manual, sin duplicar.
- [x] T010 Parser de tickets (regex) validado con PDFs reales.

## Fase 3 — Aplicación
- [x] T011 `getInsforgeBrowser` / `createInsForgeServerClient`.
- [x] T012 Middleware de sesión + `/login`.
- [x] T013 Layout + navegación (agrupada por fuente).
- [x] T014 `/` dashboard (stats + 3 gráficas).
- [x] T015 `/tickets` con filtros y paginación; tarjetas en móvil.
- [x] T016 `/tickets/[id]` (líneas, IVA, PDF).
- [x] T017 `/productos` y `/productos/[name]` (catálogo + histórico).
- [x] T018 Gestor de alias de producto.
- [x] T019 Formato (`lib/format.ts`) y tipos (`lib/types.ts`).

## Fase 4 — Calidad
- [x] T020 `npm run build` sin errores de tipos.
- [x] T021 Auditoría Lighthouse móvil (login) y corrección de contraste.
- [x] T022 Diseño responsive (tarjetas en móvil, tablas con scroll).
