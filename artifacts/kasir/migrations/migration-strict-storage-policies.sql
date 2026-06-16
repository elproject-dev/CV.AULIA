-- Hapus semua policy sebelumnya yang ada di storage.objects
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;

-- Fitur UPSERT (replace file) di Supabase memerlukan izin SELECT.
-- Agar tidak terkena warning "Broad SELECT", kita batasi SELECT hanya untuk file miliknya sendiri (owner).

CREATE POLICY "Users can select their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = owner );
