-- mercadona_spend_summary con rango de fechas (para filtrar por año).
DROP FUNCTION IF EXISTS public.mercadona_spend_summary();

CREATE OR REPLACE FUNCTION public.mercadona_spend_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'tickets', count(*),
        'total', COALESCE(sum(total), 0),
        'avg_ticket', COALESCE(round(avg(total), 2), 0)
      )
      FROM public.mercadona_tickets
      WHERE (p_from IS NULL OR purchased_at::date >= p_from)
        AND (p_to IS NULL OR purchased_at::date <= p_to)
    ),
    'monthly', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'month'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(purchased_at, 'YYYY-MM'),
          'total', round(sum(total), 2),
          'count', count(*)
        ) AS x
        FROM public.mercadona_tickets
        WHERE (p_from IS NULL OR purchased_at::date >= p_from)
          AND (p_to IS NULL OR purchased_at::date <= p_to)
        GROUP BY to_char(purchased_at, 'YYYY-MM')
      ) s
    ),
    'by_store', (
      SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'total')::numeric DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'store', store_name,
          'city', store_city,
          'total', round(sum(total), 2),
          'count', count(*)
        ) AS x
        FROM public.mercadona_tickets
        WHERE (p_from IS NULL OR purchased_at::date >= p_from)
          AND (p_to IS NULL OR purchased_at::date <= p_to)
        GROUP BY store_name, store_city
      ) s
    ),
    'top_products', (
      SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'total')::numeric DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'product', product_name,
          'total', round(sum(amount), 2),
          'count', count(*)
        ) AS x
        FROM public.mercadona_lines
        WHERE (p_from IS NULL OR purchased_at::date >= p_from)
          AND (p_to IS NULL OR purchased_at::date <= p_to)
        GROUP BY product_name
        ORDER BY sum(amount) DESC
        LIMIT 12
      ) s
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.mercadona_spend_summary(date, date) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
