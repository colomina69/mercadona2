-- Iberdrola electricity invoices: contracts, invoices, invoice lines (with €/kW and €/kWh)
-- and consumption split by tariff period (punta/llano/valle).

-- 1. Contracts
CREATE TABLE IF NOT EXISTS public.iberdrola_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL,
  label text,
  cups text,
  supply_address text,
  city text,
  titular text,
  nif text,
  tariff text,
  market text,
  plan text,
  contracted_power_punta numeric(8,3),
  contracted_power_valle numeric(8,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iberdrola_contracts_number_key UNIQUE (contract_number)
);

-- 2. Invoices
CREATE TABLE IF NOT EXISTS public.iberdrola_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  contract_id uuid REFERENCES public.iberdrola_contracts(id) ON DELETE SET NULL,
  contract_number text,
  invoice_number text NOT NULL,
  issue_date date,
  period_start date,
  period_end date,
  due_date date,
  tariff text,
  days_billed integer,
  total numeric(12,2),
  subtotal numeric(12,2),
  energy_amount numeric(12,2),
  charges_amount numeric(12,2),
  services_amount numeric(12,2),
  tax_amount numeric(12,2),
  consumption_kwh numeric(12,3),
  cups text,
  pdf_key text,
  pdf_url text,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iberdrola_invoices_number_key UNIQUE (invoice_number),
  CONSTRAINT iberdrola_invoices_message_key UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS iberdrola_invoices_contract_idx ON public.iberdrola_invoices (contract_id);
CREATE INDEX IF NOT EXISTS iberdrola_invoices_issue_date_idx ON public.iberdrola_invoices (issue_date DESC);

-- 3. Invoice lines (power €/kW·día, energy €/kWh, charges, services, taxes)
CREATE TABLE IF NOT EXISTS public.iberdrola_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.iberdrola_invoices(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  grp text,
  line_type text,
  tramo text,
  period text,
  concept text,
  detail text,
  quantity numeric(14,4),
  unit text,
  unit_price numeric(14,6),
  days integer,
  amount numeric(12,4),
  tax_base numeric(12,2),
  vat_rate numeric(8,5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iberdrola_invoice_lines_invoice_idx ON public.iberdrola_invoice_lines (invoice_id);

-- 4. Consumption by tariff period
CREATE TABLE IF NOT EXISTS public.iberdrola_invoice_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.iberdrola_invoices(id) ON DELETE CASCADE,
  tramo text NOT NULL,
  kwh numeric(12,3),
  CONSTRAINT iberdrola_invoice_consumption_key UNIQUE (invoice_id, tramo)
);

-- 5. RLS (single owner) + grants
DO $$
DECLARE
  t text;
  owner uuid := 'dfaf6414-958a-4768-9d92-a57493181524'::uuid;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'iberdrola_contracts', 'iberdrola_invoices', 'iberdrola_invoice_lines', 'iberdrola_invoice_consumption'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = %L::uuid)', t || '_select_owner', t, owner);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = %L::uuid)', t || '_insert_owner', t, owner);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = %L::uuid) WITH CHECK ((SELECT auth.uid()) = %L::uuid)', t || '_update_owner', t, owner, owner);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = %L::uuid)', t || '_delete_owner', t, owner);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END
$$;

-- 6. updated_at triggers
CREATE OR REPLACE FUNCTION public.iberdrola_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS iberdrola_contracts_updated_at ON public.iberdrola_contracts;
CREATE TRIGGER iberdrola_contracts_updated_at BEFORE UPDATE ON public.iberdrola_contracts
  FOR EACH ROW EXECUTE FUNCTION public.iberdrola_set_updated_at();

DROP TRIGGER IF EXISTS iberdrola_invoices_updated_at ON public.iberdrola_invoices;
CREATE TRIGGER iberdrola_invoices_updated_at BEFORE UPDATE ON public.iberdrola_invoices
  FOR EACH ROW EXECUTE FUNCTION public.iberdrola_set_updated_at();

-- 7. Upsert invoice (+ contract + lines + consumption)
CREATE OR REPLACE FUNCTION public.iberdrola_upsert_invoice(
  p_invoice jsonb,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_consumption jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_contract_id uuid;
  v_id uuid;
BEGIN
  IF COALESCE(p_invoice->>'contract_number', '') <> '' THEN
    INSERT INTO public.iberdrola_contracts (
      contract_number, label, cups, supply_address, city, titular, nif, tariff,
      market, plan, contracted_power_punta, contracted_power_valle, updated_at
    ) VALUES (
      p_invoice->>'contract_number',
      p_invoice->>'contract_label',
      p_invoice->>'cups',
      p_invoice->>'supply_address',
      p_invoice->>'city',
      p_invoice->>'titular',
      p_invoice->>'nif',
      p_invoice->>'tariff',
      p_invoice->>'market',
      p_invoice->>'plan',
      NULLIF(p_invoice->>'contracted_power_punta', '')::numeric,
      NULLIF(p_invoice->>'contracted_power_valle', '')::numeric,
      now()
    )
    ON CONFLICT (contract_number) DO UPDATE SET
      cups = COALESCE(EXCLUDED.cups, public.iberdrola_contracts.cups),
      supply_address = COALESCE(EXCLUDED.supply_address, public.iberdrola_contracts.supply_address),
      city = COALESCE(EXCLUDED.city, public.iberdrola_contracts.city),
      titular = COALESCE(EXCLUDED.titular, public.iberdrola_contracts.titular),
      nif = COALESCE(EXCLUDED.nif, public.iberdrola_contracts.nif),
      tariff = COALESCE(EXCLUDED.tariff, public.iberdrola_contracts.tariff),
      market = COALESCE(EXCLUDED.market, public.iberdrola_contracts.market),
      plan = COALESCE(EXCLUDED.plan, public.iberdrola_contracts.plan),
      contracted_power_punta = COALESCE(EXCLUDED.contracted_power_punta, public.iberdrola_contracts.contracted_power_punta),
      contracted_power_valle = COALESCE(EXCLUDED.contracted_power_valle, public.iberdrola_contracts.contracted_power_valle),
      label = COALESCE(public.iberdrola_contracts.label, EXCLUDED.label),
      updated_at = now()
    RETURNING id INTO v_contract_id;
  END IF;

  INSERT INTO public.iberdrola_invoices (
    message_id, contract_id, contract_number, invoice_number, issue_date, period_start, period_end,
    due_date, tariff, days_billed, total, subtotal, energy_amount, charges_amount, services_amount,
    tax_amount, consumption_kwh, cups, pdf_key, pdf_url, raw_text, updated_at
  ) VALUES (
    p_invoice->>'message_id',
    v_contract_id,
    p_invoice->>'contract_number',
    p_invoice->>'invoice_number',
    NULLIF(p_invoice->>'issue_date', '')::date,
    NULLIF(p_invoice->>'period_start', '')::date,
    NULLIF(p_invoice->>'period_end', '')::date,
    NULLIF(p_invoice->>'due_date', '')::date,
    p_invoice->>'tariff',
    NULLIF(p_invoice->>'days_billed', '')::integer,
    NULLIF(p_invoice->>'total', '')::numeric,
    NULLIF(p_invoice->>'subtotal', '')::numeric,
    NULLIF(p_invoice->>'energy_amount', '')::numeric,
    NULLIF(p_invoice->>'charges_amount', '')::numeric,
    NULLIF(p_invoice->>'services_amount', '')::numeric,
    NULLIF(p_invoice->>'tax_amount', '')::numeric,
    NULLIF(p_invoice->>'consumption_kwh', '')::numeric,
    p_invoice->>'cups',
    p_invoice->>'pdf_key',
    p_invoice->>'pdf_url',
    p_invoice->>'raw_text',
    now()
  )
  ON CONFLICT (invoice_number) DO UPDATE SET
    message_id = EXCLUDED.message_id,
    contract_id = EXCLUDED.contract_id,
    contract_number = EXCLUDED.contract_number,
    issue_date = EXCLUDED.issue_date,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    due_date = EXCLUDED.due_date,
    tariff = EXCLUDED.tariff,
    days_billed = EXCLUDED.days_billed,
    total = EXCLUDED.total,
    subtotal = EXCLUDED.subtotal,
    energy_amount = EXCLUDED.energy_amount,
    charges_amount = EXCLUDED.charges_amount,
    services_amount = EXCLUDED.services_amount,
    tax_amount = EXCLUDED.tax_amount,
    consumption_kwh = EXCLUDED.consumption_kwh,
    cups = EXCLUDED.cups,
    pdf_key = EXCLUDED.pdf_key,
    pdf_url = EXCLUDED.pdf_url,
    raw_text = EXCLUDED.raw_text,
    updated_at = now()
  RETURNING id INTO v_id;

  DELETE FROM public.iberdrola_invoice_lines WHERE invoice_id = v_id;
  INSERT INTO public.iberdrola_invoice_lines (
    invoice_id, line_no, grp, line_type, tramo, period, concept, detail,
    quantity, unit, unit_price, days, amount, tax_base, vat_rate
  )
  SELECT
    v_id,
    COALESCE(NULLIF(e->>'line_no', '')::integer, ordinality::integer),
    e->>'group',
    e->>'line_type',
    NULLIF(e->>'tramo', ''),
    e->>'period',
    e->>'concept',
    e->>'detail',
    NULLIF(e->>'quantity', '')::numeric,
    e->>'unit',
    NULLIF(e->>'unit_price', '')::numeric,
    NULLIF(e->>'days', '')::integer,
    NULLIF(e->>'amount', '')::numeric,
    NULLIF(e->>'tax_base', '')::numeric,
    NULLIF(e->>'vat_rate', '')::numeric
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality);

  DELETE FROM public.iberdrola_invoice_consumption WHERE invoice_id = v_id;
  INSERT INTO public.iberdrola_invoice_consumption (invoice_id, tramo, kwh)
  SELECT v_id, e->>'tramo', NULLIF(e->>'kwh', '')::numeric
  FROM jsonb_array_elements(COALESCE(p_consumption, '[]'::jsonb)) AS t(e)
  WHERE COALESCE(e->>'tramo', '') <> ''
  ON CONFLICT (invoice_id, tramo) DO UPDATE SET kwh = EXCLUDED.kwh;

  RETURN jsonb_build_object(
    'id', v_id,
    'contract_id', v_contract_id,
    'invoice_number', p_invoice->>'invoice_number'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.iberdrola_upsert_invoice(jsonb, jsonb, jsonb) TO authenticated;

-- 8. Message ids (for backfill dedup)
CREATE OR REPLACE FUNCTION public.iberdrola_invoice_message_ids()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(jsonb_agg(message_id), '[]'::jsonb) FROM public.iberdrola_invoices WHERE message_id IS NOT NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.iberdrola_invoice_message_ids() TO authenticated;

-- 9. Summary per contract (kWh, €, €/kWh, €/kW·día)
CREATE OR REPLACE FUNCTION public.iberdrola_summary(
  p_contract_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH f AS (
    SELECT i.*, c.label, c.tariff AS contract_tariff
    FROM public.iberdrola_invoices i
    LEFT JOIN public.iberdrola_contracts c ON c.id = i.contract_id
    WHERE (p_contract_id IS NULL OR i.contract_id = p_contract_id)
      AND (p_from IS NULL OR i.issue_date >= p_from)
      AND (p_to IS NULL OR i.issue_date <= p_to)
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'invoices', count(*),
        'kwh', COALESCE(round(sum(consumption_kwh), 3), 0),
        'total', COALESCE(round(sum(total), 2), 0),
        'energy', COALESCE(round(sum(energy_amount), 2), 0),
        'eur_per_kwh', CASE WHEN COALESCE(sum(consumption_kwh), 0) > 0
          THEN round((sum(energy_amount) / sum(consumption_kwh))::numeric, 5) ELSE NULL END,
        'first_invoice', min(issue_date),
        'last_invoice', max(issue_date)
      )
      FROM f
    ),
    'by_contract', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'label'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'contract_id', contract_id,
          'contract_number', contract_number,
          'label', COALESCE(label, contract_number),
          'tariff', contract_tariff,
          'invoices', count(*),
          'kwh', round(COALESCE(sum(consumption_kwh), 0), 3),
          'total', round(COALESCE(sum(total), 0), 2),
          'energy', round(COALESCE(sum(energy_amount), 0), 2),
          'eur_per_kwh', CASE WHEN COALESCE(sum(consumption_kwh), 0) > 0
            THEN round((sum(energy_amount) / sum(consumption_kwh))::numeric, 5) ELSE NULL END
        ) AS x
        FROM f
        GROUP BY contract_id, contract_number, label, contract_tariff
      ) s
    ),
    'power_by_contract', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'contract_id', i.contract_id,
          'avg_eur_per_kw_day', round(avg(l.unit_price), 6),
          'punta', round(avg(l.unit_price) FILTER (WHERE l.tramo = 'punta'), 6),
          'valle', round(avg(l.unit_price) FILTER (WHERE l.tramo = 'valle'), 6)
        ) AS x
        FROM public.iberdrola_invoice_lines l
        JOIN public.iberdrola_invoices i ON i.id = l.invoice_id
        WHERE l.grp = 'power' AND (p_contract_id IS NULL OR i.contract_id = p_contract_id)
        GROUP BY i.contract_id
      ) s
    ),
    'monthly', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'month'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(issue_date, 'YYYY-MM'),
          'kwh', round(COALESCE(sum(consumption_kwh), 0), 3),
          'total', round(COALESCE(sum(total), 0), 2),
          'energy', round(COALESCE(sum(energy_amount), 0), 2)
        ) AS x
        FROM f
        WHERE issue_date IS NOT NULL
        GROUP BY to_char(issue_date, 'YYYY-MM')
      ) s
    ),
    'consumption_by_tramo', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object('tramo', cc.tramo, 'kwh', round(sum(cc.kwh), 3)) AS x
        FROM public.iberdrola_invoice_consumption cc
        JOIN f ON f.id = cc.invoice_id
        GROUP BY cc.tramo
      ) s
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.iberdrola_summary(uuid, date, date) TO authenticated;

-- 10. Candidates for linking a bank movement to an invoice
CREATE OR REPLACE FUNCTION public.bank_match_invoices(
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
      'id', i.id,
      'invoice_number', i.invoice_number,
      'issue_date', i.issue_date,
      'period_start', i.period_start,
      'period_end', i.period_end,
      'total', i.total,
      'consumption_kwh', i.consumption_kwh,
      'contract_number', i.contract_number,
      'date_diff', abs(i.issue_date - tx.operation_date),
      'linked', EXISTS (
        SELECT 1 FROM public.bank_transaction_links l
        WHERE l.target_type = 'invoice' AND l.target_id = i.id
      )
    ) AS x
    FROM public.iberdrola_invoices i, tx
    WHERE i.total IS NOT NULL
      AND i.issue_date IS NOT NULL
      AND tx.operation_date IS NOT NULL
      AND abs(i.total - tx.abs_amount) <= p_tolerance
      AND abs(i.issue_date - tx.operation_date) <= p_days
    ORDER BY abs(i.issue_date - tx.operation_date), abs(i.total - tx.abs_amount)
    LIMIT 25
  ) s;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_match_invoices(uuid, integer, numeric) TO authenticated;

-- 11. Validate invoice links against iberdrola_invoices
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
  END IF;
  RETURN NEW;
END;
$function$;
