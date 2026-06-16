-- =====================================================
-- FINAL: Storage policy untuk avatar upload (SIMPLE)
-- Hanya perlu INSERT saja, tanpa delete/replace
-- Jalankan ini di SQL Editor Supabase
-- =====================================================

-- 1. Hapus SEMUA policy lama
DROP POLICY IF EXISTS "Users can select their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_avatar" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_avatar" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_avatar" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_avatar" ON storage.objects;

-- 2. Hanya perlu 1 policy: INSERT untuk anon
CREATE POLICY "anon_insert_avatar"
ON storage.objects FOR INSERT
TO anon
WITH CHECK ( bucket_id = 'avatars' );
