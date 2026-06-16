from PIL import Image, ImageOps
import os

logo_path = './public/mario.png'

print('Membaca gambar logo...')
img = Image.open(logo_path)
print(f'Dimensi original: {img.size[0]}x{img.size[1]}')

# Convert ke RGB jika perlu
if img.mode == 'RGBA':
    img = img.convert('RGB')

# Crop white borders lebih agresif
print('Menghapus white borders...')
img_trimmed = ImageOps.crop(img, border=200)
print(f'Dimensi setelah crop: {img_trimmed.size[0]}x{img_trimmed.size[1]}')

# Resize ke ukuran square yang lebih kecil (standar printer thermal)
# 384px = lebar penuh printer (32 chars * 12 pixel), logo 200px bagus
target_size = 200
print(f'Resize ke {target_size}x{target_size}...')

# Buat square canvas dengan white background
final_img = Image.new('RGB', (target_size, target_size), 'white')

# Resize logo dengan maintain aspect ratio
img_trimmed.thumbnail((target_size - 20, target_size - 20), Image.Resampling.LANCZOS)

# Paste centered
offset = ((target_size - img_trimmed.width) // 2,
          (target_size - img_trimmed.height) // 2)
final_img.paste(img_trimmed, offset)

# Save
final_img.save(logo_path, 'PNG')
print('Logo berhasil diperbaiki!')
print(f'File: {logo_path}')
print(f'Ukuran final: {target_size}x{target_size}')
