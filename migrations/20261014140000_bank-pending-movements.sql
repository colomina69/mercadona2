-- Regla de completitud de movimientos: cada movimiento debe tener una categoría y,
-- salvo que se marque como "sin documento (no aplica)", al menos un vínculo
-- (ticket/factura/repostaje/proveedor/ticket por foto).
-- RPCs de listado y recuento de "pendientes" (sin bloquear).

-- 1. Marca "sin documento (no aplica)" editable desde la app
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS document_na boolean NOT NULL DEFAULT false;

-- Solo columnas editables desde la app (financieras siguen inmutables)
GRANT UPDATE (document_na) ON public.bank_transactions TO authenticated;

-- 2. Listado de movimientos pendientes (sin categoría o sin documento)
CREATE OR REPLACE FUNCTION public.bank_pending_movements(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'operation_date') DESC NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', t.id,
      'operation_date', t.operation_date,
      'amount', t.amount,
      'description', t.description,
      'concept', t.concept,
      'category_id', t.category_id,
      'category_name', c.name,
      'document_na', t.document_na,
      'needs_category', (t.category_id IS NULL),
      'needs_link', (NOT t.document_na AND NOT EXISTS (
        SELECT 1 FROM public.bank_transaction_links l WHERE l.transaction_id = t.id
      ))
    ) AS x
    FROM public.bank_transactions t
    LEFT JOIN public.bank_categories c ON c.id = t.category_id
    WHERE (p_from IS NULL OR t.operation_date >= p_from)
      AND (p_to IS NULL OR t.operation_date <= p_to)
      AND (
        t.category_id IS NULL
        OR (NOT t.document_na AND NOT EXISTS (
          SELECT 1 FROM public.bank_transaction_links l WHERE l.transaction_id = t.id
        ))
      )
    ORDER BY t.operation_date DESC NULLS LAST, t.created_at DESC
    LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  ) s;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_pending_movements(date, date, integer, integer) TO authenticated;

-- 3. Recuento para badges
CREATE OR REPLACE FUNCTION public.bank_pending_count(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH f AS (
    SELECT
      t.category_id,
      t.document_na,
      EXISTS (SELECT 1 FROM public.bank_transaction_links l WHERE l.transaction_id = t.id) AS has_link
    FROM public.bank_transactions t
    WHERE (p_from IS NULL OR t.operation_date >= p_from)
      AND (p_to IS NULL OR t.operation_date <= p_to)
  )
  SELECT jsonb_build_object(
    'missing_category', count(*) FILTER (WHERE category_id IS NULL),
    'missing_link', count(*) FILTER (WHERE NOT document_na AND NOT has_link),
    'total', count(*) FILTER (WHERE category_id IS NULL OR (NOT document_na AND NOT has_link))
  )
  FROM f;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_pending_count(date, date) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
