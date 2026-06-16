-- Hapus policy SELECT yang memicu peringatan (warning) dari Supabase.
-- Karena bucket 'avatars' sudah bersifat public, file dapat diakses melalui public URL
-- tanpa memerlukan policy SELECT pada storage.objects. Policy SELECT justru memungkinkan
-- client untuk melakukan listing (melihat daftar semua file) yang tidak kita butuhkan.

DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
