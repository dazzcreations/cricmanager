/*
  # Create Storage Buckets

  1. New Buckets
    - `team-logos` for storing team logo images
    - `player-photos` for storing player profile photos

  2. Security
    - Enable public access for reading images
    - Restrict uploads to authenticated users with appropriate roles
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('team-logos', 'team-logos', true),
  ('player-photos', 'player-photos', true);

-- Policy for reading team logos (public)
CREATE POLICY "Team logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-logos');

-- Policy for uploading team logos (admins only)
CREATE POLICY "Only admins can upload team logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'team-logos' AND
  (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users
    JOIN public.profiles ON profiles.id = auth.uid()
    WHERE profiles.role IN ('super_admin', 'admin')
  ))
);

-- Policy for reading player photos (public)
CREATE POLICY "Player photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'player-photos');

-- Policy for uploading player photos (admins only)
CREATE POLICY "Only admins can upload player photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'player-photos' AND
  (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users
    JOIN public.profiles ON profiles.id = auth.uid()
    WHERE profiles.role IN ('super_admin', 'admin')
  ))
);

-- Policy for deleting objects (admins only)
CREATE POLICY "Only admins can delete objects"
ON storage.objects FOR DELETE
USING (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users
    JOIN public.profiles ON profiles.id = auth.uid()
    WHERE profiles.role IN ('super_admin', 'admin')
  )
);