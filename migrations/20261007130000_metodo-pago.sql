-- Solo efectivo y bizum como métodos de pago de sorteos.
-- Normaliza valores existentes ('Efectivo' -> 'efectivo') y añade un CHECK.
-- Los pagos pendientes pueden seguir con metodo_pago NULL.

UPDATE public.pagos
SET metodo_pago = lower(btrim(metodo_pago))
WHERE metodo_pago IS NOT NULL;

-- Cualquier valor que no sea efectivo/bizum pasa a NULL para revisarlo desde la app.
UPDATE public.pagos
SET metodo_pago = NULL
WHERE metodo_pago IS NOT NULL AND metodo_pago NOT IN ('efectivo', 'bizum');

ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;

ALTER TABLE public.pagos
  ADD CONSTRAINT pagos_metodo_pago_check
  CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo', 'bizum'));

SELECT pg_notify('pgrst', 'reload schema');
