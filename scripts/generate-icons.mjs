import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const source = path.join(root, 'resources/tangtang-mark.svg');
const sizes = [16, 32, 48, 64, 128, 192, 256, 512, 1024];
const pngs = new Map();

for (const size of sizes) {
  pngs.set(
    size,
    await sharp(source, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()
  );
}

function createIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = [];
  const images = [];

  for (const size of entries) {
    const image = pngs.get(size);
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.length, 8);
    entry.writeUInt32LE(offset, 12);
    directory.push(entry);
    images.push(image);
    offset += image.length;
  }

  return Buffer.concat([header, ...directory, ...images]);
}

function createIcns(entries) {
  const chunks = entries.map(([size, type]) => {
    const image = pngs.get(size);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(image.length + 8, 4);
    return Buffer.concat([header, image]);
  });
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

const ico = createIco([256, 128, 64, 48, 32, 16]);
const icns = createIcns([[128, 'ic07'], [256, 'ic08'], [512, 'ic09'], [1024, 'ic10']]);

async function write(relativePath, data) {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

await Promise.all([
  write('resources/icon.ico', ico),
  write('resources/favicon.ico', ico),
  write('resources/icon.icns', icns),
  write('resources/icon.png', pngs.get(512)),
  write('resources/icon-192.png', pngs.get(192)),
  write('resources/icon-512.png', pngs.get(512)),
  write('resources/icon-512-maskable.png', pngs.get(512)),
  write('build/icon.ico', ico),
  write('build/icon.icns', icns),
  write('build/icon.png', pngs.get(512)),
  ...[16, 32, 48, 64, 128, 256, 512, 1024].map((size) =>
    write(`build/icons/${size}x${size}.png`, pngs.get(size))
  )
]);

console.log('糖糖音乐播放器图标已生成：Windows ICO、macOS ICNS、Linux PNG、PWA PNG。');
