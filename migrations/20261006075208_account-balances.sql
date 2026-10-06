-- Daily account balance snapshots (Enable Banking / PSD2 AIS).
-- One row per account + day + source; re-running the same day updates it.

CREATE TABLE IF NOT EXISTS public.bank_account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_iban text NOT NULL,
  account_name text,
  balance numeric(14,2),
  currency text,
  as_of date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  source text NOT NULL DEFAULT 'enable_banking',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_account_balances_key UNIQUE (account_iban, as_of, source)
);

CREATE INDEX IF NOT EXISTS bank_account_balances_iban_idx
  ON public.bank_account_balances (account_iban, as_of DESC);

ALTER TABLE public.bank_account_balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bank_account_balances'
      AND policyname = 'bank_account_balances_select_owner'
  ) THEN
    CREATE POLICY bank_account_balances_select_owner
      ON public.bank_account_balances
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = 'dfaf6414-958a-4768-9d92-a57493181524'::uuid);
  END IF;
END
$$;

GRANT SELECT ON public.bank_account_balances TO anon, authenticated;

-- Idempotent upsert of balance snapshots.
CREATE OR REPLACE FUNCTION public.bank_upsert_account_balances(
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_total integer := 0;
  v_upserted integer := 0;
BEGIN
  SELECT count(*) INTO v_total
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb));

  WITH input AS (
    SELECT
      NULLIF(e->>'account_iban', '') AS account_iban,
      NULLIF(e->>'account_name', '') AS account_name,
      NULLIF(e->>'balance', '')::numeric AS balance,
      NULLIF(e->>'currency', '') AS currency,
      COALESCE(NULLIF(e->>'as_of', '')::date, (now() AT TIME ZONE 'UTC')::date) AS as_of,
      COALESCE(NULLIF(e->>'source', ''), 'enable_banking') AS source,
      CASE WHEN e ? 'raw' THEN e->'raw' ELSE NULL END AS raw
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS t(e)
    WHERE NULLIF(e->>'account_iban', '') IS NOT NULL
  ),
  ins AS (
    INSERT INTO public.bank_account_balances (
      account_iban, account_name, balance, currency, as_of, source, raw, updated_at
    )
    SELECT account_iban, account_name, balance, currency, as_of, source, raw, now()
    FROM input
    ON CONFLICT (account_iban, as_of, source) DO UPDATE SET
      account_name = EXCLUDED.account_name,
      balance = EXCLUDED.balance,
      currency = EXCLUDED.currency,
      raw = EXCLUDED.raw,
      updated_at = now()
    RETURNING 1 AS upserted
  )
  SELECT COALESCE(count(*), 0) INTO v_upserted FROM ins;

  RETURN jsonb_build_object(
    'upserted', v_upserted,
    'total', v_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bank_upsert_account_balances(jsonb) TO anon, authenticated;

SELECT pg_notify('pgrst','reload schema');
