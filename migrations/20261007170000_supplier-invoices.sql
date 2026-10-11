-- Facturas de proveedores (genérico). Primer proveedor: TRANSPORTES ALBERO S.L. (gasóleo C).

-- 1. Facturas
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  supplier_name text NOT NULL,
  supplier_tax_id text,
  supplier_email text,
  supplier_phone text,
  invoice_number text NOT NULL,
  issue_date date,
  delivery_date date,
  document_type text,
  product text,
  quantity numeric(12,3),
  unit text,
  unit_price numeric(14,6),
  base numeric(12,2),
  vat_rate numeric(5,2),
  vat_amount numeric(12,2),
  total numeric(12,2),
  payment_method text,
  customer_name text,
  customer_tax_id text,
  albaran text,
  pedido text,
  alb_circu text,
  cae text,
  cre text,
  ref_local text,
  plate text,
  driver text,
  density numeric(8,4),
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_key text,
  pdf_url text,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_invoices_unique_key UNIQUE (supplier_name, invoice_number)
);

CREATE INDEX IF NOT EXISTS supplier_invoices_message_idx ON public.supplier_invoices (message_id);
CREATE INDEX IF NOT EXISTS supplier_invoices_date_idx ON public.supplier_invoices (issue_date DESC);
CREATE INDEX IF NOT EXISTS supplier_invoices_supplier_idx ON public.supplier_invoices (supplier_name);

-- 2. Líneas
CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  product_name text,
  quantity numeric(12,3),
  unit text,
  unit_price numeric(14,6),
  amount numeric(12,2),
  vat_rate numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_invoice_lines_invoice_idx ON public.supplier_invoice_lines (invoice_id);

-- 3. RLS + grants (single owner)
DO $$
DECLARE
  t text;
  owner uuid := 'dfaf6414-958a-4768-9d92-a57493181524'::uuid;
BEGIN
  FOREACH t IN ARRAY ARRAY['supplier_invoices', 'supplier_invoice_lines'] LOOP
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
CREATE OR REPLACE FUNCTION public.supplier_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS supplier_invoices_updated_at ON public.supplier_invoices;
CREATE TRIGGER supplier_invoices_updated_at BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.supplier_set_updated_at();

-- 5. Upsert (+ líneas), idempotente por (supplier_name, invoice_number)
CREATE OR REPLACE FUNCTION public.supplier_invoice_upsert(
  p_invoice jsonb,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.supplier_invoices (
    message_id, supplier_name, supplier_tax_id, supplier_email, supplier_phone,
    invoice_number, issue_date, delivery_date, document_type, product, quantity, unit, unit_price,
    base, vat_rate, vat_amount, total, payment_method, customer_name, customer_tax_id,
    albaran, pedido, alb_circu, cae, cre, ref_local, plate, driver, density, extras,
    pdf_key, pdf_url, raw_text, updated_at
  ) VALUES (
    p_invoice->>'message_id',
    COALESCE(p_invoice->>'supplier_name', 'Proveedor'),
    p_invoice->>'supplier_tax_id',
    p_invoice->>'supplier_email',
    p_invoice->>'supplier_phone',
    p_invoice->>'invoice_number',
    NULLIF(p_invoice->>'issue_date', '')::date,
    NULLIF(p_invoice->>'delivery_date', '')::date,
    p_invoice->>'document_type',
    p_invoice->>'product',
    NULLIF(p_invoice->>'quantity', '')::numeric,
    p_invoice->>'unit',
    NULLIF(p_invoice->>'unit_price', '')::numeric,
    NULLIF(p_invoice->>'base', '')::numeric,
    NULLIF(p_invoice->>'vat_rate', '')::numeric,
    NULLIF(p_invoice->>'vat_amount', '')::numeric,
    NULLIF(p_invoice->>'total', '')::numeric,
    p_invoice->>'payment_method',
    p_invoice->>'customer_name',
    p_invoice->>'customer_tax_id',
    p_invoice->>'albaran',
    p_invoice->>'pedido',
    p_invoice->>'alb_circu',
    p_invoice->>'cae',
    p_invoice->>'cre',
    p_invoice->>'ref_local',
    p_invoice->>'plate',
    p_invoice->>'driver',
    NULLIF(p_invoice->>'density', '')::numeric,
    COALESCE(p_invoice->'extras', '{}'::jsonb),
    p_invoice->>'pdf_key',
    p_invoice->>'pdf_url',
    p_invoice->>'raw_text',
    now()
  )
  ON CONFLICT (supplier_name, invoice_number) DO UPDATE SET
    message_id = EXCLUDED.message_id,
    supplier_tax_id = EXCLUDED.supplier_tax_id,
    supplier_email = EXCLUDED.supplier_email,
    supplier_phone = EXCLUDED.supplier_phone,
    issue_date = EXCLUDED.issue_date,
    delivery_date = EXCLUDED.delivery_date,
    document_type = EXCLUDED.document_type,
    product = EXCLUDED.product,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    unit_price = EXCLUDED.unit_price,
    base = EXCLUDED.base,
    vat_rate = EXCLUDED.vat_rate,
    vat_amount = EXCLUDED.vat_amount,
    total = EXCLUDED.total,
    payment_method = EXCLUDED.payment_method,
    customer_name = EXCLUDED.customer_name,
    customer_tax_id = EXCLUDED.customer_tax_id,
    albaran = EXCLUDED.albaran,
    pedido = EXCLUDED.pedido,
    alb_circu = EXCLUDED.alb_circu,
    cae = EXCLUDED.cae,
    cre = EXCLUDED.cre,
    ref_local = EXCLUDED.ref_local,
    plate = EXCLUDED.plate,
    driver = EXCLUDED.driver,
    density = EXCLUDED.density,
    extras = EXCLUDED.extras,
    pdf_key = EXCLUDED.pdf_key,
    pdf_url = EXCLUDED.pdf_url,
    raw_text = EXCLUDED.raw_text,
    updated_at = now()
  RETURNING id INTO v_id;

  DELETE FROM public.supplier_invoice_lines WHERE invoice_id = v_id;
  INSERT INTO public.supplier_invoice_lines (invoice_id, line_no, product_name, quantity, unit, unit_price, amount, vat_rate)
  SELECT
    v_id,
    COALESCE(NULLIF(e->>'line_no', '')::integer, ordinality::integer),
    e->>'product_name',
    NULLIF(e->>'quantity', '')::numeric,
    e->>'unit',
    NULLIF(e->>'unit_price', '')::numeric,
    NULLIF(e->>'amount', '')::numeric,
    NULLIF(e->>'vat_rate', '')::numeric
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality);

  RETURN jsonb_build_object('id', v_id, 'invoice_number', p_invoice->>'invoice_number');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.supplier_invoice_upsert(jsonb, jsonb) TO authenticated;

-- 6. Message ids (backfill)
CREATE OR REPLACE FUNCTION public.supplier_invoice_message_ids()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT jsonb_build_object('ids', COALESCE(jsonb_agg(message_id), '[]'::jsonb))
  FROM public.supplier_invoices
  WHERE message_id IS NOT NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.supplier_invoice_message_ids() TO authenticated;

-- 7. Resumen (por año/supplier)
CREATE OR REPLACE FUNCTION public.supplier_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_supplier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH f AS (
    SELECT *
    FROM public.supplier_invoices
    WHERE (p_from IS NULL OR issue_date >= p_from)
      AND (p_to IS NULL OR issue_date <= p_to)
      AND (p_supplier IS NULL OR supplier_name = p_supplier)
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'invoices', count(*),
        'base', COALESCE(round(sum(base), 2), 0),
        'vat', COALESCE(round(sum(vat_amount), 2), 0),
        'total', COALESCE(round(sum(total), 2), 0)
      )
      FROM f
    ),
    'monthly', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'month'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(issue_date, 'YYYY-MM'),
          'total', round(COALESCE(sum(total), 0), 2),
          'count', count(*)
        ) AS x
        FROM f
        WHERE issue_date IS NOT NULL
        GROUP BY to_char(issue_date, 'YYYY-MM')
      ) s
    ),
    'by_supplier', (
      SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'total')::numeric DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'supplier', supplier_name,
          'tax_id', max(supplier_tax_id),
          'invoices', count(*),
          'total', round(COALESCE(sum(total), 0), 2)
        ) AS x
        FROM f
        GROUP BY supplier_name
      ) s
    ),
    'by_product', (
      SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'total')::numeric DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'product', COALESCE(product, '—'),
          'invoices', count(*),
          'quantity', round(COALESCE(sum(quantity), 0), 3),
          'total', round(COALESCE(sum(total), 0), 2)
        ) AS x
        FROM f
        GROUP BY product
      ) s
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.supplier_summary(date, date, text) TO authenticated;

-- 8. Vincular movimiento bancario -> factura de proveedor
ALTER TABLE public.bank_transaction_links DROP CONSTRAINT IF EXISTS bank_transaction_links_target_type_check;
ALTER TABLE public.bank_transaction_links
  ADD CONSTRAINT bank_transaction_links_target_type_check
  CHECK (target_type IN ('ticket', 'invoice', 'waylet', 'supplier'));

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
  END IF;
  RETURN NEW;
END;
$function$;

-- 9. Candidatos para vincular un movimiento a una factura de proveedor
CREATE OR REPLACE FUNCTION public.bank_match_supplier(
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
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'date_diff')::int, (x->>'issue_date')), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'invoice_number', s.invoice_number,
      'supplier_name', s.supplier_name,
      'issue_date', s.issue_date,
      'product', s.product,
      'total', s.total,
      'date_diff', abs(s.issue_date - tx.operation_date),
      'linked', EXISTS (
        SELECT 1 FROM public.bank_transaction_links l
        WHERE l.target_type = 'supplier' AND l.target_id = s.id
      )
    ) AS x
    FROM public.supplier_invoices s, tx
    WHERE s.total IS NOT NULL
      AND s.issue_date IS NOT NULL
      AND tx.operation_date IS NOT NULL
      AND abs(s.total - tx.abs_amount) <= p_tolerance
      AND abs(s.issue_date - tx.operation_date) <= p_days
    ORDER BY abs(s.issue_date - tx.operation_date), abs(s.total - tx.abs_amount)
    LIMIT 25
  ) s;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_match_supplier(uuid, integer, numeric) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
