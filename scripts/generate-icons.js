import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to generate uncompressed/valid raw PNG files in pure Node.js
function createPNG(size, bgColors, fgColor) {
  const width = size;
  const height = size;
  
  const lineSize = 1 + width * 4;
  const rawData = Buffer.alloc(lineSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.46;

  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineSize;
    rawData[lineOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Checkerboard effect simulation in background ring
        const isChecker = (Math.floor(x / (size * 0.125)) + Math.floor(y / (size * 0.125))) % 2 === 0;
        
        // Subject silhouette (Person icon: head circle + shoulder curve)
        const headDist = Math.sqrt(dx * dx + (dy + size * 0.14) * (dy + size * 0.14));
        const inHead = headDist < size * 0.13;
        
        const inBody = (dy > -size * 0.02 && dy < size * 0.32 && 
                        Math.abs(dx) < size * 0.28 && 
                        (Math.abs(dx) / (size * 0.28) + ((dy - size * 0.15) / (size * 0.18)) ** 2 < 1.05));

        // Magic Wand / Sparkle star in upper right
        const starDx = dx - size * 0.20;
        const starDy = dy + size * 0.20;
        const inStar = (Math.abs(starDx) < size * 0.03 && Math.abs(starDy) < size * 0.09) ||
                       (Math.abs(starDy) < size * 0.03 && Math.abs(starDx) < size * 0.09);

        if (inHead || inBody || inStar) {
          rawData[pxOffset] = fgColor.r;
          rawData[pxOffset + 1] = fgColor.g;
          rawData[pxOffset + 2] = fgColor.b;
          rawData[pxOffset + 3] = 255;
        } else {
          // Transparent checkerboard or vibrant gradient
          const factor = (x + y) / (width * 2);
          const r = isChecker ? Math.round(bgColors.r1 * (1 - factor) + bgColors.r2 * factor) : Math.round((bgColors.r1 * 0.7) * (1 - factor) + (bgColors.r2 * 0.7) * factor);
          const g = isChecker ? Math.round(bgColors.g1 * (1 - factor) + bgColors.g2 * factor) : Math.round((bgColors.g1 * 0.7) * (1 - factor) + (bgColors.g2 * 0.7) * factor);
          const b = isChecker ? Math.round(bgColors.b1 * (1 - factor) + bgColors.b2 * factor) : Math.round((bgColors.b1 * 0.7) * (1 - factor) + (bgColors.b2 * 0.7) * factor);

          const edgeDist = Math.abs(dist - radius);
          const alpha = edgeDist < 1.5 ? Math.round(180 * (1 - edgeDist / 1.5)) : 255;
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = alpha;
        }
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc >>> 0, 8 + len);
    return buf;
  }

  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return c ^ 0xffffffff;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Electric Violet (#6366f1) & Sunset Orange (#f97316)
const bg = { r1: 99, g1: 102, b1: 241, r2: 249, g2: 115, b2: 22 };
const fg = { r: 255, g: 255, b: 255 };

[16, 48, 128].forEach((size) => {
  const pngBuf = createPNG(size, bg, fg);
  const dest = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(dest, pngBuf);
  console.log(`Generated: ${dest} (${size}x${size}, ${pngBuf.length} bytes)`);
});
