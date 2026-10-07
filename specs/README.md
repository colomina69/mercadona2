# Especificaciones (Spec-Driven Development)

Documentación del proyecto **insforge** siguiendo el formato Spec Kit. Cada funcionalidad
tiene su carpeta con `spec.md` (qué/por qué), `plan.md` (cómo), `data-model.md` (datos) y
`tasks.md` (tareas).

## Índice

| Doc | Contenido |
|---|---|
| [constitution.md](constitution.md) | Principios, stack y convenciones |
| [architecture.md](architecture.md) | Visión general del sistema y flujos |
| [001-mercadona/](001-mercadona/spec.md) | Tickets y productos de Mercadona |
| [002-banca/](002-banca/spec.md) | Movimientos bancarios, categorías y vínculos |
| [003-iberdrola/](003-iberdrola/spec.md) | Facturas y contratos de Iberdrola, precios |
| [004-waylet/](004-waylet/spec.md) | Tickets de combustible Waylet (Repsol) |
| [005-movil/](005-movil/spec.md) | App móvil Expo y Sorteos (gestión) |

## Orden de lectura recomendado

1. `constitution.md` — reglas del proyecto.
2. `architecture.md` — cómo encajan las piezas.
3. `001`…`004` — funcionalidad a funcionalidad; `005` — cliente móvil.

> Estado: los dominios web están **implementados**; la app móvil (`mobile/`) y Sorteos también.
