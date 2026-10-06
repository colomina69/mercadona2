-- Enable Banking (live PSD2 AIS) transactions.
-- Extends bank_transactions with account metadata and a data source so live
-- movements coexist with imported TXT statements. The upsert RPC stays
-- backwards compatible: TXT imports (which omit the new fields) keep working.

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS account_iban text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS bank_transactions_source_idx
  ON public.bank_transactions (source);

CREATE INDEX IF NOT EXISTS bank_transactions_external_id_idx
  ON public.bank_transactions (external_id);

-- Idempotent batch upsert. Skips rows whose dedup_hash already exists.
-- New optional per-row fields: account_iban, account_name, source, external_id.
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
      NULLIF(e->>'account_iban', '') AS account_iban,
      NULLIF(e->>'account_name', '') AS account_name,
      COALESCE(NULLIF(e->>'source', ''), 'statement_txt') AS source,
      NULLIF(e->>'external_id', '') AS external_id,
      COALESCE(NULLIF(e->>'dedup_hash', ''), md5(COALESCE(e->>'raw_line', ''))) AS dedup_hash
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS t(e)
    WHERE COALESCE(e->>'dedup_hash', e->>'raw_line', '') <> ''
  ),
  ins AS (
    INSERT INTO public.bank_transactions (
      operation_date, value_date, description, amount, balance,
      counterparty_tax_id, reference, raw_line, source_file, raw_key,
      account_iban, account_name, source, external_id, dedup_hash, updated_at
    )
    SELECT
      operation_date, value_date, description, amount, balance,
      counterparty_tax_id, reference, raw_line, p_source_file, p_raw_key,
      account_iban, account_name, source, external_id, dedup_hash, now()
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

SELECT pg_notify('pgrst','reload schema');
