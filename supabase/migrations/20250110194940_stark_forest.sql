/*
  # Create storage bucket for expense proofs
  
  1. New Storage Bucket
    - Creates 'expense-proofs' bucket for storing transaction receipts and proofs
  2. Security
    - Enable public access for authenticated users
*/

-- Create the storage bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('expense-proofs', 'expense-proofs', false)
  ON CONFLICT (id) DO NOTHING;

  -- Create policy to allow authenticated users to upload files
  CREATE POLICY "Allow authenticated users to upload files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'expense-proofs' AND auth.uid() = (storage.foldername(name))[1]::uuid);

  -- Create policy to allow authenticated users to read their own files
  CREATE POLICY "Allow authenticated users to read their own files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'expense-proofs' AND auth.uid() = (storage.foldername(name))[1]::uuid);

  -- Create policy to allow authenticated users to delete their own files
  CREATE POLICY "Allow authenticated users to delete their own files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'expense-proofs' AND auth.uid() = (storage.foldername(name))[1]::uuid);
END $$;