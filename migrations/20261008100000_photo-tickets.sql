-- Tickets por foto (genérico). La imagen y el texto OCR se capturan en la app;
-- n8n sube la imagen al bucket `receipts` y crea la fila; el usuario revisa/edita.

-- 1. Tickets
CREATE TABLE IF NOT EXISTS public.photo_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  purchased_at date,
  store_name text,
  ticket_number text,
  total numeric(12,2),
  subtotal numeric(12,2),
  status text NOT NULL DEFAULT 'pendiente',
  raw_text text,
  image_key text,
  image_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_tickets_status_check CHECK (status IN ('pendiente', 'revisado'))
);

CREATE INDEX IF NOT EXISTS photo_tickets_captured_idx ON public.photo_tickets (captured_at DESC);

-- 2. Líneas
CREATE TABLE IF NOT EXISTS public.photo_ticket_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.photo_tickets(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  product_name text,
  quantity numeric(12,3),
  unit text,
  unit_price numeric(14,6),
  amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_ticket_lines_ticket_idx ON public.photo_ticket_lines (ticket_id);

-- 3. RLS + grants (single owner)
DO $$
DECLARE
  t text;
  owner uuid := 'dfaf6414-958a-4768-9d92-a57493181524'::uuid;
BEGIN
  FOREACH t IN ARRAY ARRAY['photo_tickets', 'photo_ticket_lines'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = %L::uuid)', t || '_select_owner', t, owner);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = %L::uuid)', t || '_insert_owner', t, owner);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = %L::uuid) WITH CHECK ((SELECT auth.uid()) = %L::uuid)', t || '_update_owner', t, owner, owner);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = %L::uuid)', t || '_delete_owner', t, owner);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END
$$;

-- 4. updated_at
CREATE OR REPLACE FUNCTION public.photo_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS photo_tickets_updated_at ON public.photo_tickets;
CREATE TRIGGER photo_tickets_updated_at BEFORE UPDATE ON public.photo_tickets
  FOR EACH ROW EXECUTE FUNCTION public.photo_set_updated_at();

-- 5. Crear (lo llama n8n tras subir la imagen)
CREATE OR REPLACE FUNCTION public.photo_ticket_create(p_ticket jsonb)
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

  RETURN jsonb_build_object('id', v_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.photo_ticket_create(jsonb) TO authenticated;

-- 6. Editar (revisión desde la app; reemplaza líneas)
CREATE OR REPLACE FUNCTION public.photo_ticket_update(
  p_id uuid,
  p_fields jsonb,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.photo_tickets SET
    purchased_at = COALESCE(NULLIF(p_fields->>'purchased_at', '')::date, purchased_at),
    store_name = COALESCE(p_fields->>'store_name', store_name),
    ticket_number = COALESCE(p_fields->>'ticket_number', ticket_number),
    total = COALESCE(NULLIF(p_fields->>'total', '')::numeric, total),
    subtotal = COALESCE(NULLIF(p_fields->>'subtotal', '')::numeric, subtotal),
    notes = COALESCE(p_fields->>'notes', notes),
    status = COALESCE(p_fields->>'status', 'revisado'),
    updated_at = now()
  WHERE id = p_id;

  DELETE FROM public.photo_ticket_lines WHERE ticket_id = p_id;
  INSERT INTO public.photo_ticket_lines (ticket_id, line_no, product_name, quantity, unit, unit_price, amount)
  SELECT
    p_id,
    COALESCE(NULLIF(e->>'line_no', '')::integer, ordinality::integer),
    e->>'product_name',
    NULLIF(e->>'quantity', '')::numeric,
    e->>'unit',
    NULLIF(e->>'unit_price', '')::numeric,
    NULLIF(e->>'amount', '')::numeric
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality);

  RETURN jsonb_build_object('id', p_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.photo_ticket_update(uuid, jsonb, jsonb) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
