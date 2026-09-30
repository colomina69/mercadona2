-- Bank transactions imported from BBVA-style pipe-delimited text exports.
-- Columns map to the 7 fields: operation date, description, value date,
-- amount, balance, counterparty tax id, reference.

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_date date,
  value_date date,
  description text,
  amount numeric(14,2),
  balance numeric(14,2),
  counterparty_tax_id text,
  reference text,
  raw_line text,
  source_file text,
  raw_key text,
  dedup_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transactions_dedup_hash_key UNIQUE (dedup_hash)
);

CREATE INDEX IF NOT EXISTS bank_transactions_operation_date_idx
  ON public.bank_transactions (operation_date DESC);

CREATE INDEX IF NOT EXISTS bank_transactions_amount_idx
  ON public.bank_transactions (amount);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bank_transactions'
      AND policyname = 'bank_transactions_select_owner'
  ) THEN
    CREATE POLICY bank_transactions_select_owner
      ON public.bank_transactions
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);
  END IF;
END
$$;

GRANT SELECT ON public.bank_transactions TO anon, authenticated;

-- Idempotent batch upsert. Skips rows whose dedup_hash already exists.
CREATE OR REPLACE FUNCTION public.bank_upsert_transactions(
  p_rows jsonb,
  p_source_file text DEFAULT NULL,
  p_raw_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_inserted integer := 0;
  v_total integer := 0;
BEGIN
  SELECT count(*) INTO v_total
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb));

  WITH input AS (
    SELECT
      NULLIF(e->>'operation_date', '')::date AS operation_date,
      NULLIF(e->>'value_date', '')::date AS value_date,
      e->>'description' AS description,
      NULLIF(e->>'amount', '')::numeric AS amount,
      NULLIF(e->>'balance', '')::numeric AS balance,
      NULLIF(e->>'counterparty_tax_id', '') AS counterparty_tax_id,
      NULLIF(e->>'reference', '') AS reference,
      e->>'raw_line' AS raw_line,
      COALESCE(NULLIF(e->>'dedup_hash', ''), md5(COALESCE(e->>'raw_line', ''))) AS dedup_hash
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS t(e)
    WHERE COALESCE(e->>'dedup_hash', e->>'raw_line', '') <> ''
  ),
  ins AS (
    INSERT INTO public.bank_transactions (
      operation_date, value_date, description, amount, balance,
      counterparty_tax_id, reference, raw_line, source_file, raw_key,
      dedup_hash, updated_at
    )
    SELECT
      operation_date, value_date, description, amount, balance,
      counterparty_tax_id, reference, raw_line, p_source_file, p_raw_key,
      dedup_hash, now()
    FROM input
    ON CONFLICT (dedup_hash) DO NOTHING
    RETURNING 1 AS inserted
  )
  SELECT COALESCE(count(*), 0) INTO v_inserted FROM ins;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped', GREATEST(v_total - v_inserted, 0),
    'total', v_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_upsert_transactions(jsonb, text, text) TO anon, authenticated;

-- Aggregated view for the dashboard, optionally scoped by date.
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
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.bank_summary(date, date) TO anon, authenticated;
