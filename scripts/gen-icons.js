/* Genera iconos PNG (192 y 512) para el manifest PWA sin dependencias.
 * Icono: fondo azul (#2563eb) con triángulo blanco (reproducir) centrado. */
const fs = require('fs');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function png(width, height, px) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filtro None
    px.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function dibujar(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [0x25, 0x63, 0xeb, 0xff]; // azul #2563eb
  const fg = [0xff, 0xff, 0xff, 0xff]; // blanco
  const cx = size / 2;
  const triW = size * 0.34;
  const triH = size * 0.38;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Triángulo (punta izquierda) centrado: base vertical a la derecha
      const dx = x - cx + triW / 2;
      const dy = y - cx;
      const enTri = dx >= -triW / 2 && dx <= triW / 2 &&
        Math.abs(dy) <= triH / 2 * (1 - Math.abs(dx) / (triW / 2 + 0.001));
      const c = enTri ? fg : bg;
      const i = (y * size + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
    }
  }
  return px;
}

fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-192.png', png(192, 192, dibujar(192)));
fs.writeFileSync('public/icons/icon-512.png', png(512, 512, dibujar(512)));
console.log('Iconos generados: public/icons/icon-192.png, icon-512.png');
