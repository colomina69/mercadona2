# 005 — Modelo de datos

## Sorteos (InsForge `public`)

### `abonados`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `nombre` | text NOT NULL | |
| `grupos` | text[] NOT NULL | subconjunto de `{mensual, extraordinario}`; por defecto `{mensual}` |
| `activo` | boolean NOT NULL | default `true` |
| `created_at` | timestamptz | |

Un abonado puede pertenecer a varios grupos. El **grupo del sorteo** se deriva de `sorteos.tipo`:
`mensual` → `mensual`, `especial` → `extraordinario`.

### `sorteos`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `nombre` | text NOT NULL | |
| `fecha` | date NOT NULL | |
| `precio` | numeric NOT NULL | `CHECK > 0` |
| `tipo` | text NOT NULL default `mensual` | `CHECK ∈ {mensual, especial}` |
| `decimos_totales` | integer NULL | `CHECK ≥ 0` |
| `created_at` | timestamptz default `now()` | |

### `pagos`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `abonado_id` | uuid NOT NULL | FK → `abonados(id)` ON DELETE CASCADE |
| `sorteo_id` | uuid NOT NULL | FK → `sorteos(id)` ON DELETE CASCADE |
| `estado` | text NOT NULL default `pending` | uso: `pending` / `paid` |
| `fecha_pago` | timestamptz NULL | |
| `metodo_pago` | text NULL | `CHECK ∈ {efectivo, bizum}` o NULL |
| `cantidad` | integer NOT NULL default 1 | nº de participaciones |
| `created_at` | timestamptz default `now()` | |

Restricción única: `(abonado_id, sorteo_id)`.

### `push_tokens`
`id` uuid PK, `token` text UNIQUE, `platform` text NULL, `created_at`/`updated_at`.
(No usada en esta versión.)

## RLS

- `sorteos`, `pagos` y `abonados`: política `ALL` a `public` (abiertas).
- `push_tokens`: política `ALL` a `authenticated`.
- La app móvil usa la **API key admin**, por lo que accede con independencia de estas políticas.
