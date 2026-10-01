-- Allow the signed-in owner to download invoices from the private `iberdrola`
-- bucket. Mirrors the existing `storage_objects_mercadona_select` policy.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'storage_objects_iberdrola_select'
  ) THEN
    CREATE POLICY storage_objects_iberdrola_select ON storage.objects
      FOR SELECT TO authenticated
      USING (
        (bucket = 'iberdrola'::text)
        AND ((SELECT (auth.jwt() ->> 'sub'::text)) = 'dfaf6414-958a-4768-9d92-a57493181524'::text)
      );
  END IF;
END
$$;
