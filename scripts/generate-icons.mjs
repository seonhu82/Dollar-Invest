import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG 아이콘 - PATH 기반 달러 사인 (폰트 불필요, 어떤 서버에서든 렌더링 가능)
// 검은 배경 (#111827) + 흰색 $ 기호
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="108" fill="#111827"/>
  <g transform="translate(256,256)">
    <!-- $ 기호: 세로 줄 -->
    <rect x="-14" y="-170" width="28" height="340" rx="14" fill="white"/>
    <!-- S 상단 곡선 -->
    <path d="M-80,-120 C-80,-165 -45,-185 0,-185 C45,-185 80,-165 80,-130 C80,-105 65,-90 40,-80 L-10,-60"
          fill="none" stroke="white" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- S 하단 곡선 -->
    <path d="M10,60 L60,80 C85,90 100,110 100,135 C100,175 65,195 0,195 C-50,195 -90,175 -100,135"
          fill="none" stroke="white" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// 더 심플한 버전 - 순수 도형 기반 (폰트/스트로크 이슈 완전 방지)
const svgIconSimple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="108" fill="#111827"/>
  <!-- 세로선 위 -->
  <rect x="242" y="80" width="28" height="60" rx="14" fill="white"/>
  <!-- 세로선 아래 -->
  <rect x="242" y="372" width="28" height="60" rx="14" fill="white"/>
  <!-- S자 상단호 (위쪽 반원 + 연결) -->
  <path d="M296 168 C296 132 268 112 244 112 L232 112 C194 112 168 134 168 168 C168 198 186 214 224 228 L288 252"
        fill="none" stroke="white" stroke-width="46" stroke-linecap="round"/>
  <!-- S자 하단호 (아래쪽 반원 + 연결) -->
  <path d="M224 260 L288 284 C326 298 344 318 344 348 C344 382 316 400 280 400 L268 400 C230 400 204 382 196 352"
        fill="none" stroke="white" stroke-width="46" stroke-linecap="round"/>
</svg>`;

// 가장 안정적인 버전 - filled path만 사용 (stroke 없음)
const svgIconFilled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="108" fill="#111827"/>
  <path d="
    M236 80 h40 v48 c40 6 72 22 96 50 l-32 28 c-18-22-38-36-64-42 v86 l16 6 c30 12 52 26 66 44 c14 18 22 40 22 66 c0 34-12 62-34 82 c-22 20-50 32-86 36 v52 h-40 v-52 c-44-6-82-26-110-60 l34-28 c22 26 46 42 76 48 v-94 l-14-6 c-28-12-48-26-62-44 c-14-18-20-40-20-66 c0-32 10-58 32-76 c20-18 46-28 78-32 V80 z
    M236 170 c-18 6-32 16-40 28 c-10 14-14 28-14 46 c0 16 4 30 14 42 c10 10 24 20 44 28 v-144 z
    M276 306 v150 c20-6 36-16 46-30 c12-14 18-32 18-52 c0-18-6-34-16-46 c-12-12-28-22-48-28 v6 z
  " fill="white"/>
</svg>`;

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

async function generate() {
  // filled path 버전 사용 (가장 안정적)
  const svgBuffer = Buffer.from(svgIconFilled);

  for (const { name, size } of sizes) {
    const outputPath = join(publicDir, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${name} (${size}x${size})`);
  }

  // favicon.ico (32x32 PNG)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(join(publicDir, 'favicon.ico'));
  console.log('Generated: favicon.ico');

  // SVG 원본도 저장
  const { writeFileSync } = await import('fs');
  writeFileSync(join(publicDir, 'icon.svg'), svgIconFilled);
  console.log('Saved: icon.svg');

  console.log('\nAll icons generated successfully!');
}

generate().catch(console.error);
