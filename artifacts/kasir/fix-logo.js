import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const logoPath = path.resolve('./public/mario.png');
const tempPath = path.resolve('./public/mario.temp.png');

async function fixLogoCenter() {
  try {
    console.log('📦 Membaca gambar logo...');

    // Baca metadata gambar original
    const metadata = await sharp(logoPath).metadata();
    console.log(`Dimensi original: ${metadata.width}x${metadata.height}`);

    // Trim ruang kosong (crop whitespace)
    console.log('✂️ Menghapus ruang kosong...');
    const trimmed = await sharp(logoPath)
      .trim({
        background: '#ffffff',
        lineArtTolerance: 0
      })
      .toBuffer({ resolveWithObject: true });

    const trimmedMetadata = trimmed.info;
    console.log(`Dimensi setelah trim: ${trimmedMetadata.width}x${trimmedMetadata.height}`);

    // Tentukan ukuran square (gunakan dimensi yang lebih besar)
    const size = Math.max(trimmedMetadata.width, trimmedMetadata.height) + 50; // tambah padding
    console.log(`Ukuran square target: ${size}x${size}`);

    // Buat gambar baru dengan background putih dan logo centered
    console.log('🎨 Processing gambar agar centered...');

    await sharp(trimmed.data)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(tempPath);

    // Ganti file original dengan file baru
    fs.renameSync(tempPath, logoPath);

    console.log('✅ Logo berhasil diperbaiki dan disimpan!');
    console.log(`📍 File: ${logoPath}`);
    console.log(`📐 Ukuran final: ${size}x${size}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    // Clean up temp file jika ada error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    process.exit(1);
  }
}

fixLogoCenter();
