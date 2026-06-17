import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = process.argv[2] ?? path.join(root, 'public/icons/icon-512x512.png');
const outDir = path.join(root, 'public/icons');

mkdirSync(outDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(path.join(outDir, `icon-${size}x${size}.png`));
}

await sharp(src).resize(32, 32).png().toFile(path.join(root, 'public/favicon-32.png'));
await sharp(src).resize(180, 180).png().toFile(path.join(root, 'public/apple-touch-icon.png'));
await sharp(src).resize(48, 48).png().toFile(path.join(root, 'public/favicon.ico'));

console.log('PWA icons generated from', src);
