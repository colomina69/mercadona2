-- Sugerencia automática de categoría: primero por historial (mismo comercio/
-- concepto) y, si no hay, por palabras clave del movimiento contra los nombres
-- de las categorías existentes. Devuelve {category_id, score, source}.
CREATE OR REPLACE FUNCTION public.bank_suggest_category(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH me AS (
    SELECT
      upper(COALESCE(concept, '') || ' ' || COALESCE(description, '')) AS txt,
      counterparty_tax_id,
      concept,
      description
    FROM public.bank_transactions
    WHERE id = p_transaction_id
  ),
  hist AS (
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
    ORDER BY score DESC
    LIMIT 1
  ),
  kw AS (
    SELECT c.id AS category_id, 1 AS score
    FROM public.bank_categories c, me
    WHERE
      (me.txt ~ '(MERCADONA|CONSUM|CARREFOUR|LIDL|ALDI|AHORRAMAS|MASYMAS|SUPER|HIPERCOR|DIA )' AND c.name ~* '(super|aliment|comida|compra|ultramar)')
      OR (me.txt ~ '(IBERDROLA|NATURGY|ENDESA|AIGUES|GAS|AGUA|LUZ|VODAFONE|MOVISTAR|ORANGE|JAZZTEL|DIGI|YOIGO|TELECOM)' AND c.name ~* '(suministr|luz|agua|gas|telefon|internet)')
      OR (me.txt ~ '(REPSOL|CEPSA|GALP|SHELL|GASOLIN|PEAJE|PARKING|RENFE|METRO|TAXI)' AND c.name ~* '(transport|gasolin|coche|combust|movilidad)')
      OR (me.txt ~ '(RESTAURANT|CAFETER|MCDONALD|BURGER|PIZZA|KEBAB|BAR )' AND c.name ~* '(restaurant|comida|bar|ocio)')
      OR (me.txt ~ '(FARMACIA|CLINICA|DENTISTA|HOSPITAL|MEDICO)' AND c.name ~* '(salud|farmacia|medic)')
      OR (me.txt ~ '(NETFLIX|SPOTIFY|HBO|DISNEY|PRIME|FILMIN|STEAM|PLAYSTATION)' AND c.name ~* '(ocio|suscripc|streaming|entretenim)')
      OR (me.txt ~ '(NOMINA|SUELDO|PAYROLL)' AND c.name ~* '(nomina|sueldo|salario)')
    ORDER BY c.sort_order
    LIMIT 1
  )
  SELECT jsonb_build_object('category_id', category_id, 'score', score, 'source', source)
  FROM (
    SELECT category_id, score, 'historial' AS source FROM hist
    UNION ALL
    SELECT category_id, 1 AS score, 'keywords' AS source FROM kw
  ) s
  ORDER BY score DESC
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_suggest_category(uuid) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
