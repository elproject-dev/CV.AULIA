import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'transaksi.wav');
const targetDir = join(root, 'android', 'app', 'src', 'main', 'res', 'raw');
const target = join(targetDir, 'transaksi.wav');

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);

console.log('Copied notification sound to android/app/src/main/res/raw/transaksi.wav');
