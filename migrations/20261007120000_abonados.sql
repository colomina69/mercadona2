-- Abonados de sorteos.
-- La tabla puede existir ya (con una columna `tipo` simple). Esta migración la
-- normaliza a `grupos text[]` (multi-grupo):
--   'mensual'        -> sorteos con tipo = 'mensual'
--   'extraordinario' -> sorteos con tipo = 'especial' (Nadal, Niño, ...)
-- Un abonado puede pertenecer a ambos grupos.

CREATE TABLE IF NOT EXISTS public.abonados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  grupos text[] NOT NULL DEFAULT ARRAY['mensual']::text[],
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT abonados_grupos_check CHECK (grupos <@ ARRAY['mensual', 'extraordinario']::text[])
);

-- Añadir `grupos` si la tabla preexistía con `tipo`.
ALTER TABLE public.abonados ADD COLUMN IF NOT EXISTS grupos text[];

-- Backfill de `grupos` desde `tipo` (si la columna antigua existe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'abonados' AND column_name = 'tipo'
  ) THEN
    UPDATE public.abonados
    SET grupos = CASE
      WHEN tipo = 'extraordinario' THEN ARRAY['extraordinario']::text[]
      ELSE ARRAY['mensual']::text[]
    END
    WHERE grupos IS NULL OR grupos = '{}'::text[];
  END IF;
END
$$;

UPDATE public.abonados SET grupos = ARRAY['mensual']::text[] WHERE grupos IS NULL OR grupos = '{}'::text[];

ALTER TABLE public.abonados ALTER COLUMN grupos SET DEFAULT ARRAY['mensual']::text[];
ALTER TABLE public.abonados ALTER COLUMN grupos SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'abonados_grupos_check') THEN
    ALTER TABLE public.abonados
      ADD CONSTRAINT abonados_grupos_check CHECK (grupos <@ ARRAY['mensual', 'extraordinario']::text[]);
  END IF;
END
$$;

-- La columna antigua `tipo` queda representada por `grupos`.
ALTER TABLE public.abonados DROP COLUMN IF EXISTS tipo;

-- RLS + política + permisos.
ALTER TABLE public.abonados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'abonados' AND policyname = 'abonados_all'
  ) THEN
    CREATE POLICY abonados_all ON public.abonados
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abonados TO anon, authenticated;

-- Integridad: pagos.abonado_id debe existir en abonados.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_abonado_id_fkey') THEN
    ALTER TABLE public.pagos
      ADD CONSTRAINT pagos_abonado_id_fkey
      FOREIGN KEY (abonado_id) REFERENCES public.abonados(id) ON DELETE CASCADE;
  END IF;
END
$$;

SELECT pg_notify('pgrst', 'reload schema');
