import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG 아이콘 원본 (고해상도)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af"/>
      <stop offset="100%" style="stop-color:#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <text x="256" y="340" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="320" fill="white">$</text>
  <polygon points="400,100 440,160 420,160 420,200 380,200 380,160 360,160" fill="#34d399" opacity="0.9"/>
</svg>`;

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

async function generate() {
  for (const { name, size } of sizes) {
    const outputPath = join(publicDir, name);
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${name} (${size}x${size})`);
  }

  // favicon.ico (32x32 PNG renamed)
  await sharp(Buffer.from(svgIcon))
    .resize(32, 32)
    .png()
    .toFile(join(publicDir, 'favicon.ico'));
  console.log('Generated: favicon.ico');

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
