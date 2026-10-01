-- Price evolution per contract: energy EUR/kWh and power EUR/kW·day over time.

CREATE OR REPLACE FUNCTION public.iberdrola_price_history(p_contract_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'issue_date'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'contract_id', i.contract_id,
      'label', COALESCE(c.label, c.contract_number),
      'issue_date', i.issue_date,
      'energy_eur_kwh', max(l.unit_price) FILTER (WHERE l.line_type = 'energia'),
      'power_punta', max(l.unit_price) FILTER (WHERE l.line_type = 'potencia_punta'),
      'power_valle', max(l.unit_price) FILTER (WHERE l.line_type = 'potencia_valle')
    ) AS x
    FROM public.iberdrola_invoices i
    JOIN public.iberdrola_contracts c ON c.id = i.contract_id
    LEFT JOIN public.iberdrola_invoice_lines l ON l.invoice_id = i.id AND l.grp IN ('energy', 'power')
    WHERE (p_contract_id IS NULL OR i.contract_id = p_contract_id)
      AND i.issue_date IS NOT NULL
    GROUP BY i.id, i.contract_id, c.label, c.contract_number, i.issue_date
  ) s;
$function$;

GRANT EXECUTE ON FUNCTION public.iberdrola_price_history(uuid) TO authenticated;
