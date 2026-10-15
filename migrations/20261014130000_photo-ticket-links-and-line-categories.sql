-- Tickets por foto: categorías de producto (catálogo propio) por línea, y
-- vínculo de cada ticket con movimientos bancarios (bank_transaction_links).

-- 1. Catálogo propio de categorías de producto (independiente de bank_categories)
CREATE TABLE IF NOT EXISTS public.photo_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_ticket_categories_name_key UNIQUE (name)
);

ALTER TABLE public.photo_ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY photo_ticket_categories_select_owner ON public.photo_ticket_categories
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY photo_ticket_categories_insert_owner ON public.photo_ticket_categories
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY photo_ticket_categories_update_owner ON public.photo_ticket_categories
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid)
  WITH CHECK ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY photo_ticket_categories_delete_owner ON public.photo_ticket_categories
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_ticket_categories TO authenticated;

INSERT INTO public.photo_ticket_categories (name, sort_order) VALUES
  ('Alimentación', 10),
  ('Frutas y verduras', 20),
  ('Carnicería / pescadería', 30),
  ('Panadería', 40),
  ('Congelados', 50),
  ('Bebidas', 60),
  ('Limpieza', 70),
  ('Higiene personal', 80),
  ('Mascotas', 90),
  ('Bebé', 100),
  ('Otros', 999)
ON CONFLICT (name) DO NOTHING;

-- 2. Categoría por línea de producto
ALTER TABLE public.photo_ticket_lines
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.photo_ticket_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS photo_ticket_lines_category_idx
  ON public.photo_ticket_lines (category_id);

-- 3. Permitir vincular movimientos bancarios con tickets por foto
ALTER TABLE public.bank_transaction_links DROP CONSTRAINT IF EXISTS bank_transaction_links_target_type_check;
ALTER TABLE public.bank_transaction_links
  ADD CONSTRAINT bank_transaction_links_target_type_check
  CHECK (target_type IN ('ticket', 'invoice', 'waylet', 'supplier', 'photo_ticket'));

CREATE OR REPLACE FUNCTION public.bank_links_validate_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NEW.target_type = 'ticket' THEN
    IF NOT EXISTS (SELECT 1 FROM public.mercadona_tickets WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'Ticket % no existe', NEW.target_id;
    END IF;
  ELSIF NEW.target_type = 'invoice' THEN
    IF NOT EXISTS (SELECT 1 FROM public.iberdrola_invoices WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'Factura % no existe', NEW.target_id;
    END IF;
  ELSIF NEW.target_type = 'waylet' THEN
    IF NOT EXISTS (SELECT 1 FROM public.waylet_tickets WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'Ticket Waylet % no existe', NEW.target_id;
    END IF;
  ELSIF NEW.target_type = 'supplier' THEN
    IF NOT EXISTS (SELECT 1 FROM public.supplier_invoices WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'Factura de proveedor % no existe', NEW.target_id;
    END IF;
  ELSIF NEW.target_type = 'photo_ticket' THEN
    IF NOT EXISTS (SELECT 1 FROM public.photo_tickets WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'Ticket por foto % no existe', NEW.target_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Candidatos para vincular un movimiento a un ticket por foto
CREATE OR REPLACE FUNCTION public.bank_match_photo_tickets(
  p_transaction_id uuid,
  p_days integer DEFAULT 5,
  p_tolerance numeric DEFAULT 0.02
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH tx AS (
    SELECT id, operation_date, abs(COALESCE(amount, 0)) AS abs_amount
    FROM public.bank_transactions
    WHERE id = p_transaction_id
  )
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'date_diff')::int, (x->>'purchased_at')), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', t.id,
      'ticket_number', t.ticket_number,
      'purchased_at', t.purchased_at,
      'store_name', t.store_name,
      'total', t.total,
      'date_diff', abs((t.purchased_at)::date - tx.operation_date),
      'linked', EXISTS (
        SELECT 1 FROM public.bank_transaction_links l
        WHERE l.target_type = 'photo_ticket' AND l.target_id = t.id
      )
    ) AS x
    FROM public.photo_tickets t, tx
    WHERE t.total IS NOT NULL
      AND t.purchased_at IS NOT NULL
      AND tx.operation_date IS NOT NULL
      AND abs(t.total - tx.abs_amount) <= p_tolerance
      AND abs((t.purchased_at)::date - tx.operation_date) <= p_days
    ORDER BY abs((t.purchased_at)::date - tx.operation_date), abs(t.total - tx.abs_amount)
    LIMIT 25
  ) s;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_match_photo_tickets(uuid, integer, numeric) TO authenticated;

-- 5. Persistir category_id por línea al crear/editar
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
    ticket_id, line_no, product_name, quantity, unit, unit_price, amount, category_id
  )
  SELECT
    v_id,
    COALESCE(NULLIF(e->>'line_no', '')::integer, ordinality::integer),
    e->>'product_name',
    NULLIF(e->>'quantity', '')::numeric,
    e->>'unit',
    NULLIF(e->>'unit_price', '')::numeric,
    NULLIF(e->>'amount', '')::numeric,
    NULLIF(e->>'category_id', '')::uuid
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality);

  RETURN jsonb_build_object('id', v_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.photo_ticket_create(jsonb, jsonb) TO authenticated;

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
  INSERT INTO public.photo_ticket_lines (ticket_id, line_no, product_name, quantity, unit, unit_price, amount, category_id)
  SELECT
    p_id,
    COALESCE(NULLIF(e->>'line_no', '')::integer, ordinality::integer),
    e->>'product_name',
    NULLIF(e->>'quantity', '')::numeric,
    e->>'unit',
    NULLIF(e->>'unit_price', '')::numeric,
    NULLIF(e->>'amount', '')::numeric,
    NULLIF(e->>'category_id', '')::uuid
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality);

  RETURN jsonb_build_object('id', p_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.photo_ticket_update(uuid, jsonb, jsonb) TO authenticated;

-- 6. updated_at
DROP TRIGGER IF EXISTS photo_ticket_categories_updated_at ON public.photo_ticket_categories;
CREATE TRIGGER photo_ticket_categories_updated_at
  BEFORE UPDATE ON public.photo_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.photo_set_updated_at();

SELECT pg_notify('pgrst', 'reload schema');
