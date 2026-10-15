-- Subcategorías en bank_categories (2 niveles: categoría -> subcategoría).

ALTER TABLE public.bank_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.bank_categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS bank_categories_parent_idx
  ON public.bank_categories (parent_id);

-- Unicidad por (padre, nombre) en lugar de nombre global
ALTER TABLE public.bank_categories DROP CONSTRAINT IF EXISTS bank_categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS bank_categories_parent_name_key
  ON public.bank_categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Validación: máx. 2 niveles, sin auto-referencia, y una categoría con hijos no puede pasar a ser hija
CREATE OR REPLACE FUNCTION public.bank_categories_validate_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_parent public.bank_categories%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Una categoría no puede ser su propio padre';
    END IF;

    SELECT * INTO v_parent FROM public.bank_categories WHERE id = NEW.parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La categoría padre % no existe', NEW.parent_id;
    END IF;
    IF v_parent.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo se permiten 2 niveles (categoría > subcategoría)';
    END IF;

    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1 FROM public.bank_categories WHERE parent_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Una categoría con subcategorías no puede convertirse en subcategoría';
    END IF;

    -- Hereda el tipo (gasto/ingreso) del padre
    NEW.kind := v_parent.kind;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bank_categories_validate_parent ON public.bank_categories;
CREATE TRIGGER bank_categories_validate_parent
  BEFORE INSERT OR UPDATE ON public.bank_categories
  FOR EACH ROW EXECUTE FUNCTION public.bank_categories_validate_parent();

SELECT pg_notify('pgrst', 'reload schema');
