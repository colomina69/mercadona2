# 005 — Plan

## Stack

- **Expo SDK 57** + **Expo Router** (rutas por fichero en `mobile/src/app/`), React 19,
  React Native 0.86, TypeScript.
- `@insforge/sdk` con **`createAdminClient`** (sin login).
- Gráficas propias con `View` (sin dependencias nativas) para funcionar en Expo Go.

## Estructura

```
mobile/
  app.json, metro.config.js, tsconfig.json, .env(.example)
  assets/pdfjs/                  # pdf.min.pdfjs + pdf.worker.min.pdfjs (visor offline)
  src/
    app/                         # rutas (Expo Router)
      _layout.tsx                # Stack raíz
      index.tsx                  # portada de botones
      pdf.tsx                    # visor PDF in-app (PDF.js en WebView)
      mercadona/…
      iberdrola/…
      combustible/…
      cuenta/…
      sorteos/…                   # index, nuevo, editar/[id], [id], abonados[/nuevo|/[id]]
    components/                  # ui.tsx, charts.tsx, SorteoForm.tsx, AbonadoForm.tsx, PdfButton.tsx
    lib/                         # insforge.ts, types.ts, format.ts, theme.ts, useAsync.ts
    shims/crypto.js              # alias del builtin de Node para Metro
```

## Configuración

- `package.json`: `main = expo-router/entry`; `.npmrc` con `legacy-peer-deps=true`.
- `app.json`: `scheme: misgastos`, plugins `expo-router`, `expo-status-bar`, `expo-sharing`, `expo-asset`.
- `tsconfig.json`: `paths { "@/*": ["./src/*"] }` (sin `baseUrl`).
- `metro.config.js`: `resolver.extraNodeModules.crypto → src/shims/crypto.js` y
  `assetExts.push('pdfjs')` (assets de PDF.js).
- Visor PDF: `.pdfjs` se leen en base64 y se inyectan en el HTML (API + worker blob), sin CDN.

## Consultas

| Sección | Fuente |
|---|---|
| Mercadona | RPC `mercadona_spend_summary`, `mercadona_products`, `mercadona_product_history`; `mercadona_tickets(_items)` |
| Iberdrola | RPC `iberdrola_summary`; `iberdrola_invoices(_lines/_consumption)`, `iberdrola_contracts` |
| Combustible | RPC `waylet_summary`; `waylet_tickets(_lines)` |
| Cuenta | RPC `bank_summary`, `bank_match_*`; `bank_transactions`, `bank_categories`, `bank_transaction_links`, `bank_account_balances` |
| Sorteos | `sorteos`, `abonados`, `pagos` |

## Verificación

```bash
cd mobile
npx tsc --noEmit
npx expo export --platform android
npx expo start      # dispositivo/emulador con Expo Go
```
