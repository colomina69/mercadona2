-- Allow the signed-in owner to download supplier invoices from the private `suppliers` bucket.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'storage_objects_suppliers_select'
  ) THEN
    CREATE POLICY storage_objects_suppliers_select ON storage.objects
      FOR SELECT TO authenticated
      USING (
        (bucket = 'suppliers'::text)
        AND ((SELECT (auth.jwt() ->> 'sub'::text)) = 'dfaf6414-958a-4768-9d92-a57493181524'::text)
      );
  END IF;
END
$$;
