-- Return {ids:[...]} instead of a bare array so the n8n HTTP node always
-- yields one item (an empty JSON array yields zero items and breaks the chain).

CREATE OR REPLACE FUNCTION public.iberdrola_invoice_message_ids()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT jsonb_build_object('ids', COALESCE(jsonb_agg(message_id), '[]'::jsonb))
  FROM public.iberdrola_invoices
  WHERE message_id IS NOT NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.iberdrola_invoice_message_ids() TO authenticated;
