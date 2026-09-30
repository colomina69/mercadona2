-- Categories, transaction categorization, and ticket/invoice links for bank movements.

-- 1. Categories (expense/income types defined by the user)
CREATE TABLE IF NOT EXISTS public.bank_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'income')),
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_categories_name_key UNIQUE (name)
);

ALTER TABLE public.bank_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_categories_select_owner ON public.bank_categories
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY bank_categories_insert_owner ON public.bank_categories
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY bank_categories_update_owner ON public.bank_categories
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid)
  WITH CHECK ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY bank_categories_delete_owner ON public.bank_categories
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_categories TO authenticated;

INSERT INTO public.bank_categories (name, kind, sort_order) VALUES
  ('Supermercado', 'expense', 10),
  ('Restaurantes', 'expense', 20),
  ('Suministros', 'expense', 30),
  ('Transporte', 'expense', 40),
  ('Hogar', 'expense', 50),
  ('Salud', 'expense', 60),
  ('Ocio/Suscripciones', 'expense', 70),
  ('Compras', 'expense', 80),
  ('Otros gastos', 'expense', 90),
  ('Nómina', 'income', 10),
  ('Bizum recibido', 'income', 20),
  ('Otros ingresos', 'income', 30)
ON CONFLICT (name) DO NOTHING;

-- 2. Editable concept + category on transactions
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS concept text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.bank_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bank_transactions_category_id_idx
  ON public.bank_transactions (category_id);

CREATE POLICY bank_transactions_update_owner ON public.bank_transactions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid)
  WITH CHECK ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

-- Only concept and category_id are editable from the app; keep financial fields immutable.
REVOKE UPDATE ON public.bank_transactions FROM anon, authenticated;
GRANT UPDATE (concept, category_id) ON public.bank_transactions TO authenticated;

-- 3. Links between movements and tickets (later: invoices) — many-to-many
CREATE TABLE IF NOT EXISTS public.bank_transaction_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('ticket', 'invoice')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transaction_links_unique UNIQUE (transaction_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS bank_transaction_links_tx_idx
  ON public.bank_transaction_links (transaction_id);
CREATE INDEX IF NOT EXISTS bank_transaction_links_target_idx
  ON public.bank_transaction_links (target_type, target_id);

ALTER TABLE public.bank_transaction_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_transaction_links_select_owner ON public.bank_transaction_links
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY bank_transaction_links_insert_owner ON public.bank_transaction_links
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY bank_transaction_links_update_owner ON public.bank_transaction_links
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid)
  WITH CHECK ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

CREATE POLICY bank_transaction_links_delete_owner ON public.bank_transaction_links
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transaction_links TO authenticated;

-- Validate polymorphic targets (only tickets for now).
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
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bank_transaction_links_validate ON public.bank_transaction_links;
CREATE TRIGGER bank_transaction_links_validate
  BEFORE INSERT OR UPDATE ON public.bank_transaction_links
  FOR EACH ROW EXECUTE FUNCTION public.bank_links_validate_target();

-- 4. updated_at maintenance
CREATE OR REPLACE FUNCTION public.bank_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bank_categories_updated_at ON public.bank_categories;
CREATE TRIGGER bank_categories_updated_at
  BEFORE UPDATE ON public.bank_categories
  FOR EACH ROW EXECUTE FUNCTION public.bank_set_updated_at();

DROP TRIGGER IF EXISTS bank_transactions_updated_at ON public.bank_transactions;
CREATE TRIGGER bank_transactions_updated_at
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.bank_set_updated_at();

DROP TRIGGER IF EXISTS bank_transaction_links_updated_at ON public.bank_transaction_links;
CREATE TRIGGER bank_transaction_links_updated_at
  BEFORE UPDATE ON public.bank_transaction_links
  FOR EACH ROW EXECUTE FUNCTION public.bank_set_updated_at();

-- 5. Candidate tickets for a movement (same amount within tolerance and close date)
CREATE OR REPLACE FUNCTION public.bank_match_tickets(
  p_transaction_id uuid,
  p_days integer DEFAULT 3,
  p_tolerance numeric DEFAULT 0.02
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH tx AS (
    SELECT
      id,
      operation_date,
      abs(COALESCE(amount, 0)) AS abs_amount
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
      'store_city', t.store_city,
      'total', t.total,
      'date_diff', abs((t.purchased_at)::date - tx.operation_date),
      'linked', EXISTS (
        SELECT 1 FROM public.bank_transaction_links l
        WHERE l.target_type = 'ticket' AND l.target_id = t.id
      )
    ) AS x
    FROM public.mercadona_tickets t, tx
    WHERE t.total IS NOT NULL
      AND t.purchased_at IS NOT NULL
      AND tx.operation_date IS NOT NULL
      AND abs(t.total - tx.abs_amount) <= p_tolerance
      AND abs((t.purchased_at)::date - tx.operation_date) <= p_days
    ORDER BY abs((t.purchased_at)::date - tx.operation_date), abs(t.total - tx.abs_amount)
    LIMIT 25
  ) s;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_match_tickets(uuid, integer, numeric) TO authenticated;

-- 6. Extend summary with a by-category breakdown
CREATE OR REPLACE FUNCTION public.bank_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH f AS (
    SELECT *
    FROM public.bank_transactions
    WHERE (p_from IS NULL OR operation_date >= p_from)
      AND (p_to IS NULL OR operation_date <= p_to)
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'transactions', count(*),
        'inflow', COALESCE(round(sum(amount) FILTER (WHERE amount > 0), 2), 0),
        'outflow', COALESCE(round(sum(amount) FILTER (WHERE amount < 0), 2), 0),
        'net', COALESCE(round(sum(amount), 2), 0),
        'last_balance', (SELECT balance FROM f ORDER BY operation_date DESC NULLS LAST, created_at DESC LIMIT 1)
      )
      FROM f
    ),
    'monthly', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'month'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(operation_date, 'YYYY-MM'),
          'inflow', round(COALESCE(sum(amount) FILTER (WHERE amount > 0), 0), 2),
          'outflow', round(COALESCE(sum(amount) FILTER (WHERE amount < 0), 0), 2)
        ) AS x
        FROM f
        WHERE operation_date IS NOT NULL
        GROUP BY to_char(operation_date, 'YYYY-MM')
      ) s
    ),
    'by_category', (
      SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'total')::numeric), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'category', COALESCE(c.name, 'Sin categoría'),
          'kind', COALESCE(c.kind, 'expense'),
          'total', round(sum(f.amount), 2),
          'count', count(*)
        ) AS x
        FROM f
        LEFT JOIN public.bank_categories c ON c.id = f.category_id
        GROUP BY c.name, c.kind
      ) s
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.bank_summary(date, date) TO authenticated;
