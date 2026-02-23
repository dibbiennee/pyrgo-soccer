import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

const SIZES = [72, 96, 128, 144, 192, 384, 512];
const BG = '#1a1a2e';
const FG = '#ff5500';

function makeSvg(size) {
  const fontSize = Math.round(size * 0.38);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${BG}" rx="${Math.round(size * 0.15)}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif" font-weight="900"
        font-size="${fontSize}" fill="${FG}">PS</text>
</svg>`;
}

async function generate() {
  // App icons
  for (const size of SIZES) {
    const svg = Buffer.from(makeSvg(size));
    await sharp(svg).png().toFile(resolve(outDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // OG image (1200x630)
  const ogSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${BG}"/>
  <text x="600" y="260" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif" font-weight="900"
        font-size="120" fill="${FG}">PYRGO</text>
  <text x="600" y="400" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif" font-weight="900"
        font-size="80" fill="#00ccff">SOCCER</text>
</svg>`);
  await sharp(ogSvg).png().toFile(resolve(outDir, '../og-image.png'));
  console.log('Generated og-image.png');
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
