import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG 아이콘 원본 (헤더 로고와 동일: 검은 배경 + 흰색 달러 사인)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="108" fill="#111827"/>
  <g transform="translate(256,256)" fill="none" stroke="white" stroke-width="36" stroke-linecap="round" stroke-linejoin="round">
    <line x1="0" y1="-160" x2="0" y2="160"/>
    <path d="M80,-120 C80,-120 80,-120 0,-120 C-88,-120 -88,-20 0,-20 C88,-20 88,80 0,80 C0,80 0,80 -80,80" fill="none"/>
  </g>
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
