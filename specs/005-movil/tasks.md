# 005 — Tareas

## Proyecto

- [x] T001 Scaffold Expo (`blank-typescript`) en `mobile/`; añadir Expo Router y deps.
- [x] T002 Configurar `package.json` (`expo-router/entry`), `app.json` (scheme), `tsconfig` (paths).
- [x] T003 `.npmrc` (legacy-peer-deps), `metro.config.js` + `src/shims/crypto.js`, `.env(.example)`.
- [x] T004 `src/lib`: `insforge.ts` (admin), `types.ts`, `format.ts`, `theme.ts`, `useAsync.ts`.
- [x] T005 `src/components`: `ui.tsx`, `charts.tsx`, `SorteoForm.tsx`.

## Pantallas

- [x] T010 `_layout.tsx` (Stack) + `index.tsx` (portada de botones + saldo).
- [x] T011 Mercadona: `index`, `tickets`, `tickets/[id]`, `productos`, `productos/[name]`.
- [x] T012 Iberdrola: `facturas`, `facturas/[id]`, `contratos`, `contratos/[id]`.
- [x] T013 Combustible: `index`, `[id]`.
- [x] T014 Cuenta: `movimientos`, `movimientos/[id]` (editar + vincular), `categorias`.
- [x] T015 Sorteos: `index`, `nuevo`, `editar/[id]`, `[id]` (gestión de pagos).
- [x] T016 `PdfButton` (descarga autenticada) + visor in-app `/pdf` (PDF.js en `WebView`).
- [x] T017 Abonados: `sorteos/abonados` (lista), `nuevo`, `[id]`; `AbonadoForm` y grupos múltiples;
  migración `20261007120000_abonados` (grupos + FK pagos→abonados).
- [x] T018 Detalle de sorteo: décimos (vender/asignados/disponibles), edición destacada y **Cobros
  por método** (efectivo/bizum/otros) con la lista agrupada por método.
- [x] T019 Métodos de pago solo **efectivo/bizum**: migración `20261007130000_metodo-pago`
  (normaliza + CHECK) y toggle efectivo↔bizum en el detalle.
- [x] T020 Filtro por **año** en los resúmenes (web y móvil) de Mercadona, Iberdrola, Combustible y
  Cuenta; migración `20261007150000_mercadona-summary-range` (rango en `mercadona_spend_summary`).
- [x] T021 **Desglose por años** en el detalle de contrato de Iberdrola (web y móvil).
- [x] T022 **Clasificador de movimientos** (web `/clasificar` + `Classifier`; móvil
  `cuenta/clasificar`) con asignación por fila/en bloque, vinculación de tickets/facturas y
  "Vaciar categorías".
- [x] T023 **Página de vincular** (móvil `cuenta/vincular/[id]`) con categoría manual + **sugerencia
  automática** (RPC `bank_suggest_category`) y búsqueda de archivados; sugerencia también en el
  editor web `/movimientos/[id]`.

## Verificación

- [x] T090 `npx tsc --noEmit` sin errores.
- [x] T091 `npx expo export --platform android` empaqueta correctamente.
