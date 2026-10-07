-- Sugerencia automática de categoría para un movimiento, basada en el historial:
-- el mismo comercio (counterparty_tax_id) pesa más que el mismo concepto/descripción.
CREATE OR REPLACE FUNCTION public.bank_suggest_category(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH me AS (
    SELECT counterparty_tax_id, concept, description
    FROM public.bank_transactions
    WHERE id = p_transaction_id
  ),
  scored AS (
    SELECT
      t.category_id,
      sum(
        CASE
          WHEN m.counterparty_tax_id IS NOT NULL AND t.counterparty_tax_id = m.counterparty_tax_id THEN 3
          WHEN m.concept IS NOT NULL AND t.concept = m.concept THEN 2
          WHEN m.description IS NOT NULL AND t.description = m.description THEN 1
          ELSE 0
        END
      )::int AS score
    FROM public.bank_transactions t, me m
    WHERE t.category_id IS NOT NULL
      AND t.id <> p_transaction_id
      AND (
        (m.counterparty_tax_id IS NOT NULL AND t.counterparty_tax_id = m.counterparty_tax_id)
        OR (m.concept IS NOT NULL AND t.concept = m.concept)
        OR (m.description IS NOT NULL AND t.description = m.description)
      )
    GROUP BY t.category_id
  )
  SELECT jsonb_build_object('category_id', category_id, 'score', score)
  FROM scored
  ORDER BY score DESC
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_suggest_category(uuid) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
