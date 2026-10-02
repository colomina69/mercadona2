-- Waylet fuel tickets (Repsol/ES GLEM S.L) received by email as a download link.

-- 1. Tickets
CREATE TABLE IF NOT EXISTS public.waylet_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  waylet_id text,
  ticket_number text NOT NULL,
  purchased_at timestamptz,
  station_name text,
  address text,
  postal_code text,
  locality text,
  fuel_type text,
  liters numeric(10,3),
  unit_price numeric(10,4),
  gross_amount numeric(12,2),
  discount_amount numeric(12,2),
  total numeric(12,2),
  payment_method text,
  card_last4 text,
  vehicle_plate text,
  points numeric(12,3),
  pdf_key text,
  pdf_url text,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waylet_tickets_number_key UNIQUE (ticket_number)
);

CREATE INDEX IF NOT EXISTS waylet_tickets_message_idx ON public.waylet_tickets (message_id);
CREATE INDEX IF NOT EXISTS waylet_tickets_date_idx ON public.waylet_tickets (purchased_at DESC);

-- 2. Extra lines (fuel + discounts + other products)
CREATE TABLE IF NOT EXISTS public.waylet_ticket_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.waylet_tickets(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  product_name text,
  unit_price numeric(10,4),
  amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waylet_ticket_lines_ticket_idx ON public.waylet_ticket_lines (ticket_id);

-- 3. RLS + grants (single owner)
DO $$
DECLARE
  t text;
  owner uuid := 'dfaf6414-958a-4768-9d92-a57493181524'::uuid;
BEGIN
  FOREACH t IN ARRAY ARRAY['waylet_tickets', 'waylet_ticket_lines'] LOOP
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
CREATE OR REPLACE FUNCTION public.waylet_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS waylet_tickets_updated_at ON public.waylet_tickets;
CREATE TRIGGER waylet_tickets_updated_at BEFORE UPDATE ON public.waylet_tickets
  FOR EACH ROW EXECUTE FUNCTION public.waylet_set_updated_at();

-- 5. Upsert (+ lines)
CREATE OR REPLACE FUNCTION public.waylet_upsert_ticket(
  p_ticket jsonb,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.waylet_tickets (
    message_id, waylet_id, ticket_number, purchased_at, station_name, address, postal_code, locality,
    fuel_type, liters, unit_price, gross_amount, discount_amount, total, payment_method, card_last4,
    vehicle_plate, points, pdf_key, pdf_url, raw_text, updated_at
  ) VALUES (
    p_ticket->>'message_id',
    p_ticket->>'waylet_id',
    p_ticket->>'ticket_number',
    NULLIF(p_ticket->>'purchased_at', '')::timestamptz,
    p_ticket->>'station_name',
    p_ticket->>'address',
    p_ticket->>'postal_code',
    p_ticket->>'locality',
    p_ticket->>'fuel_type',
    NULLIF(p_ticket->>'liters', '')::numeric,
    NULLIF(p_ticket->>'unit_price', '')::numeric,
    NULLIF(p_ticket->>'gross_amount', '')::numeric,
    NULLIF(p_ticket->>'discount_amount', '')::numeric,
    NULLIF(p_ticket->>'total', '')::numeric,
    p_ticket->>'payment_method',
    p_ticket->>'card_last4',
    p_ticket->>'vehicle_plate',
    NULLIF(p_ticket->>'points', '')::numeric,
    p_ticket->>'pdf_key',
    p_ticket->>'pdf_url',
    p_ticket->>'raw_text',
    now()
  )
  ON CONFLICT (ticket_number) DO UPDATE SET
    message_id = EXCLUDED.message_id,
    waylet_id = EXCLUDED.waylet_id,
    purchased_at = EXCLUDED.purchased_at,
    station_name = EXCLUDED.station_name,
    address = EXCLUDED.address,
    postal_code = EXCLUDED.postal_code,
    locality = EXCLUDED.locality,
    fuel_type = EXCLUDED.fuel_type,
    liters = EXCLUDED.liters,
    unit_price = EXCLUDED.unit_price,
    gross_amount = EXCLUDED.gross_amount,
    discount_amount = EXCLUDED.discount_amount,
    total = EXCLUDED.total,
    payment_method = EXCLUDED.payment_method,
    card_last4 = EXCLUDED.card_last4,
    vehicle_plate = EXCLUDED.vehicle_plate,
    points = EXCLUDED.points,
    pdf_key = EXCLUDED.pdf_key,
    pdf_url = EXCLUDED.pdf_url,
    raw_text = EXCLUDED.raw_text,
    updated_at = now()
  RETURNING id INTO v_id;

  DELETE FROM public.waylet_ticket_lines WHERE ticket_id = v_id;
  INSERT INTO public.waylet_ticket_lines (ticket_id, line_no, product_name, unit_price, amount)
  SELECT
    v_id,
    COALESCE(NULLIF(e->>'line_no', '')::integer, ordinality::integer),
    e->>'product_name',
    NULLIF(e->>'unit_price', '')::numeric,
    NULLIF(e->>'amount', '')::numeric
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality);

  RETURN jsonb_build_object('id', v_id, 'ticket_number', p_ticket->>'ticket_number');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.waylet_upsert_ticket(jsonb, jsonb) TO authenticated;

-- 6. Message ids (backfill)
CREATE OR REPLACE FUNCTION public.waylet_ticket_message_ids()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT jsonb_build_object('ids', COALESCE(jsonb_agg(message_id), '[]'::jsonb))
  FROM public.waylet_tickets
  WHERE message_id IS NOT NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.waylet_ticket_message_ids() TO authenticated;

-- 7. Summary
CREATE OR REPLACE FUNCTION public.waylet_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH f AS (
    SELECT *
    FROM public.waylet_tickets
    WHERE (p_from IS NULL OR purchased_at::date >= p_from)
      AND (p_to IS NULL OR purchased_at::date <= p_to)
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'tickets', count(*),
        'liters', COALESCE(round(sum(liters), 3), 0),
        'total', COALESCE(round(sum(total), 2), 0),
        'gross', COALESCE(round(sum(gross_amount), 2), 0),
        'discount', COALESCE(round(sum(discount_amount), 2), 0),
        'eur_per_l', CASE WHEN COALESCE(sum(liters), 0) > 0
          THEN round((sum(gross_amount) / sum(liters))::numeric, 4) ELSE NULL END,
        'eur_per_l_paid', CASE WHEN COALESCE(sum(liters), 0) > 0
          THEN round((sum(total) / sum(liters))::numeric, 4) ELSE NULL END,
        'first_ticket', min(purchased_at::date),
        'last_ticket', max(purchased_at::date)
      )
      FROM f
    ),
    'monthly', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'month'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(purchased_at, 'YYYY-MM'),
          'liters', round(COALESCE(sum(liters), 0), 3),
          'total', round(COALESCE(sum(total), 0), 2),
          'eur_per_l', CASE WHEN COALESCE(sum(liters), 0) > 0
            THEN round((sum(gross_amount) / sum(liters))::numeric, 4) ELSE NULL END
        ) AS x
        FROM f
        WHERE purchased_at IS NOT NULL
        GROUP BY to_char(purchased_at, 'YYYY-MM')
      ) s
    ),
    'by_station', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'station'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'station', COALESCE(station_name, 'Sin estación'),
          'locality', max(locality),
          'tickets', count(*),
          'liters', round(COALESCE(sum(liters), 0), 3),
          'total', round(COALESCE(sum(total), 0), 2)
        ) AS x
        FROM f
        GROUP BY station_name
      ) s
    ),
    'by_fuel', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'fuel'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'fuel', COALESCE(fuel_type, '—'),
          'tickets', count(*),
          'liters', round(COALESCE(sum(liters), 0), 3),
          'total', round(COALESCE(sum(total), 0), 2)
        ) AS x
        FROM f
        GROUP BY fuel_type
      ) s
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.waylet_summary(date, date) TO authenticated;

-- 8. Allow linking a bank movement to a waylet ticket
ALTER TABLE public.bank_transaction_links DROP CONSTRAINT IF EXISTS bank_transaction_links_target_type_check;
ALTER TABLE public.bank_transaction_links
  ADD CONSTRAINT bank_transaction_links_target_type_check
  CHECK (target_type IN ('ticket', 'invoice', 'waylet'));

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
  END IF;
  RETURN NEW;
END;
$function$;

-- 9. Candidates for linking a bank movement to a waylet ticket
CREATE OR REPLACE FUNCTION public.bank_match_waylet(
  p_transaction_id uuid,
  p_days integer DEFAULT 7,
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
      'id', w.id,
      'ticket_number', w.ticket_number,
      'purchased_at', w.purchased_at,
      'station_name', w.station_name,
      'locality', w.locality,
      'fuel_type', w.fuel_type,
      'liters', w.liters,
      'unit_price', w.unit_price,
      'total', w.total,
      'date_diff', abs(w.purchased_at::date - tx.operation_date),
      'linked', EXISTS (
        SELECT 1 FROM public.bank_transaction_links l
        WHERE l.target_type = 'waylet' AND l.target_id = w.id
      )
    ) AS x
    FROM public.waylet_tickets w, tx
    WHERE w.total IS NOT NULL
      AND w.purchased_at IS NOT NULL
      AND tx.operation_date IS NOT NULL
      AND abs(w.total - tx.abs_amount) <= p_tolerance
      AND abs(w.purchased_at::date - tx.operation_date) <= p_days
    ORDER BY abs(w.purchased_at::date - tx.operation_date), abs(w.total - tx.abs_amount)
    LIMIT 25
  ) s;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_match_waylet(uuid, integer, numeric) TO authenticated;
