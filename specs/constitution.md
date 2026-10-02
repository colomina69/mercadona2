# Constitución del proyecto

> Documento rector de la metodología SDD (Spec-Driven Development) para el proyecto
> **insforge** (app de gastos: Mercadona, Iberdrola y bancos).

## 1. Propósito

Aplicación personal para **centralizar y analizar gastos domésticos** a partir de:

- **Tickets de Mercadona** (PDF por email).
- **Facturas de Iberdrola** (PDF por email).
- **Movimientos bancarios** (extracto TXT subido manualmente).

Todo se almacena y consulta a través de **InsForge** (Postgres + Storage + RLS).

## 2. Principios (no negociables)

1. **InsForge es la única fuente de verdad.** La base de datos, el almacenamiento y
   la autenticación viven en InsForge. La app no mantiene estado propio persistente.
2. **RLS por propietario.** Todas las tablas de negocio exponen solo las filas del
   usuario autenticado (`auth.uid()` / `auth.jwt()->>'sub'`). El bucket de almacenamiento
   replica la misma regla mediante políticas de `storage.objects`.
3. **Datos crudos inmutables.** El texto original (`raw_text`, `raw_line`) y los importes
   extraídos de la fuente (PDF/extracto) **nunca** se sobrescriben. Lo editable (concepto,
   categoría, vínculos) vive en columnas/tablas separadas.
4. **Idempotencia.** Cada importación define una clave natural de deduplicación
   (`message_id` para emails, `invoice_number`, `dedup_hash` para movimientos) y usa
   `ON CONFLICT` para no duplicar ni pisar ediciones del usuario.
5. **Separación lógica de aplicación e infraestructura.** El SDK `@insforge/sdk` gestiona
   datos/auth/almacenamiento; la CLI `insforge` (y las migraciones) gestionan esquema,
   RLS y buckets. No se mezclan.
6. **Secretos fuera del repositorio.** Las claves se leen de `.env.local` (app) y
   `.insforge/project.json` (CLI). Nunca se hardcodean ni se suben.
7. **UI responsive y accesible de serie.** Mobile-first, contraste AA, áreas táctiles
   ≥ 40 px, sombras/estados claros.

## 3. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | Next.js 14.2 (App Router) + React 18 | Server Components por defecto |
| Estilos | Tailwind CSS 3.4 | **No** actualizar a v4 |
| SDK | `@insforge/sdk` (server + browser) | Patrón `{ data, error }` |
| Backend | InsForge (PostgreSQL + PostgREST) | Esquema `public` |
| Almacenamiento | InsForge Storage (buckets privados) | PDFs y extractos |
| Automatización | n8n (MCP `@n8n/workflow-sdk`) | Gmail + HTTP a InsForge |
| Hosting | Vercel (proyecto `insforge`) | Alias `insforge-mu.vercel.app` |
| Gestión | InsForge CLI + migraciones versionadas | `migrations/*.sql` |

## 4. Convenciones

- **Migraciones**: un archivo SQL por cambio de esquema en `migrations/`, aplicadas con
  `db migrations up`. Nada de DDL a mano fuera de ellas (salvo correctivos puntuales).
- **Privilegios + RLS**: se conceden privilegios SQL **y** políticas RLS; las políticas no
  sustituyen a los `GRANT`. Para columnas inmutables se revoca `UPDATE` y se concede solo
  sobre las columnas editables.
- **RPCs** para lógica de escritura/agregación atómica (`*_upsert_*`, `*_summary`,
  `*_match_*`, `*_price_history`), siempre `SECURITY` acorde al caso y con `GRANT EXECUTE`.
- **Nombres**: tablas y columnas en `snake_case`; RPCs `verbo_sustantivo`. Prefijos por
  dominio: `mercadona_*`, `bank_*`, `iberdrola_*`.
- **Zona horaria/fechas**: `date` para fechas de negocio (días), `timestamptz` para marcas
  de sistema (`created_at`, `updated_at`).
- **Importes**: `numeric(12,2)` (y `numeric(14,6)` en precios unitarios como `€/kWh`).

## 5. Flujo SDD

Cada funcionalidad se documenta en `specs/<NNN>-<nombre>/` con:

1. `spec.md` — qué y por qué (historias, requisitos, criterios de aceptación).
2. `plan.md` — cómo (arquitectura, contratos, fases, decisiones).
3. `data-model.md` — entidades, relaciones, RLS, RPCs, almacenamiento.
4. `tasks.md` — desglose de tareas y estado.

La documentación describe el **estado implementado** del sistema (transcripción) y
sirve de contrato para futuras iteraciones.

## 6. Ámbito

- **Dentro**: ingesta de tickets Mercadona, facturas Iberdrola, movimientos bancarios;
  categorización y vinculación; consultas y gráficas; despliegue.
- **Fuera**: multi-usuario real (el sistema es de un único propietario), facturación y
  otras pasarelas, facturas de otros proveedores (previsto vía `target_type` genérico).
