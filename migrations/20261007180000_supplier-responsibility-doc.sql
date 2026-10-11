-- Documento de responsabilidad que acompaña a cada factura del proveedor.
-- Se guarda su clave en la propia fila de la factura (no genera datos aparte).

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS responsibility_pdf_key text,
  ADD COLUMN IF NOT EXISTS responsibility_pdf_url text,
  ADD COLUMN IF NOT EXISTS responsibility_filename text;

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
    pdf_key, pdf_url, responsibility_pdf_key, responsibility_pdf_url, responsibility_filename,
    raw_text, updated_at
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
    p_invoice->>'responsibility_pdf_key',
    p_invoice->>'responsibility_pdf_url',
    p_invoice->>'responsibility_filename',
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
    responsibility_pdf_key = EXCLUDED.responsibility_pdf_key,
    responsibility_pdf_url = EXCLUDED.responsibility_pdf_url,
    responsibility_filename = EXCLUDED.responsibility_filename,
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

SELECT pg_notify('pgrst', 'reload schema');
