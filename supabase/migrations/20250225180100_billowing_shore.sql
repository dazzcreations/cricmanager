/*
  # Fix Storage Policies

  1. Changes
    - Update storage policies to correctly handle file uploads
    - Add UPDATE policy for storage objects
    - Fix role check in policies

  2. Security
    - Maintain public read access
    - Restrict write operations to authenticated admins
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Team logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload team logos" ON storage.objects;
DROP POLICY IF EXISTS "Player photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload player photos" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete objects" ON storage.objects;

-- Create new policies with correct role checks
CREATE POLICY "Public can view all storage objects"
ON storage.objects FOR SELECT
USING (true);

CREATE POLICY "Admins can insert storage objects"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Admins can update storage objects"
ON storage.objects FOR UPDATE
USING (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Admins can delete storage objects"
ON storage.objects FOR DELETE
USING (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);