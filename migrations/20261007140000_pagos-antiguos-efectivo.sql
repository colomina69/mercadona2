-- Pagos antiguos ya cobrados pero sin método registrado (Febrero/Marzo 2026):
-- se asigna 'efectivo' por defecto para que cuenten como cobrados.
UPDATE public.pagos
SET metodo_pago = 'efectivo'
WHERE estado = 'paid' AND metodo_pago IS NULL;

SELECT pg_notify('pgrst', 'reload schema');
