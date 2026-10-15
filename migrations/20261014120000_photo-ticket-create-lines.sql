-- Tickets por foto: permitir crear la fila CON sus líneas en una sola llamada.
-- El agente de IA de n8n extrae cabecera + líneas del ticket y las inserta aquí,
-- de modo que el detalle de la app ya aparece relleno (antes solo se insertaban
-- líneas al guardar desde el editor, en photo_ticket_update).

-- La firma antigua (1 argumento) haría ambigua la llamada con p_lines por defecto:
DROP FUNCTION IF EXISTS public.photo_ticket_create(jsonb);

CREATE OR REPLACE FUNCTION public.photo_ticket_create(
  p_ticket jsonb,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.photo_tickets (
    captured_at, purchased_at, store_name, ticket_number, total, subtotal,
    status, raw_text, image_key, image_url, notes
  ) VALUES (
    COALESCE(NULLIF(p_ticket->>'captured_at', '')::timestamptz, now()),
    NULLIF(p_ticket->>'purchased_at', '')::date,
    p_ticket->>'store_name',
    p_ticket->>'ticket_number',
    NULLIF(p_ticket->>'total', '')::numeric,
    NULLIF(p_ticket->>'subtotal', '')::numeric,
    COALESCE(NULLIF(p_ticket->>'status', ''), 'pendiente'),
    p_ticket->>'raw_text',
    p_ticket->>'image_key',
    p_ticket->>'image_url',
    p_ticket->>'notes'
  )
  RETURNING id INTO v_id;

  INSERT INTO public.photo_ticket_lines (
    ticket_id, line_no, product_name, quantity, unit, unit_price, amount
  )
  SELECT
    v_id,
    COALESCE(NULLIF(e->>'line_no', '')::integer, ordinality::integer),
    e->>'product_name',
    NULLIF(e->>'quantity', '')::numeric,
    e->>'unit',
    NULLIF(e->>'unit_price', '')::numeric,
    NULLIF(e->>'amount', '')::numeric
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality);

  RETURN jsonb_build_object('id', v_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.photo_ticket_create(jsonb, jsonb) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
