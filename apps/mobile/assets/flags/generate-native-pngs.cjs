'use strict';

// Reproducible raster fallback for React Native, which does not guarantee SVG
// data-URI decoding. Run from the repository root with:
//   node apps/mobile/assets/flags/generate-native-pngs.cjs
// The geometric designs share the CC0-1.0 dedication in LICENSE.md.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const W = 96;
const H = 64;
const out = path.join(__dirname, 'png');

function rgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function canvas(color) {
  const image = new PNG({ width: W, height: H });
  const [r, g, b] = rgb(color);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = r;
    image.data[offset + 1] = g;
    image.data[offset + 2] = b;
    image.data[offset + 3] = 255;
  }
  return image;
}

function pixel(image, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  const offset = (py * W + px) * 4;
  const [r, g, b] = rgb(color);
  image.data[offset] = r;
  image.data[offset + 1] = g;
  image.data[offset + 2] = b;
  image.data[offset + 3] = 255;
}

function rect(image, x, y, width, height, color) {
  for (let py = Math.max(0, Math.floor(y)); py < Math.min(H, Math.ceil(y + height)); py += 1) {
    for (let px = Math.max(0, Math.floor(x)); px < Math.min(W, Math.ceil(x + width)); px += 1) {
      pixel(image, px, py, color);
    }
  }
}

function circle(image, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) pixel(image, x, y, color);
    }
  }
}

function line(image, x0, y0, x1, y1, width, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let step = 0; step <= steps; step += 1) {
    const x = x0 + ((x1 - x0) * step) / steps;
    const y = y0 + ((y1 - y0) * step) / steps;
    rect(image, x - width / 2, y - width / 2, width, width, color);
  }
}

function polygon(image, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map(([, y]) => y))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map(([, y]) => y))));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      rect(image, intersections[i], y, intersections[i + 1] - intersections[i] + 1, 1, color);
    }
  }
}

function star(image, cx, cy, outer, color, points = 5) {
  const vertices = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : outer * 0.42;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    vertices.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  polygon(image, vertices, color);
}

function horizontal(colors, weights = colors.map(() => 1)) {
  const image = canvas(colors[0]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let y = 0;
  colors.forEach((color, index) => {
    const height = index === colors.length - 1 ? H - y : H * weights[index] / total;
    rect(image, 0, y, W, height, color);
    y += height;
  });
  return image;
}

function vertical(colors, weights = colors.map(() => 1)) {
  const image = canvas(colors[0]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let x = 0;
  colors.forEach((color, index) => {
    const width = index === colors.length - 1 ? W - x : W * weights[index] / total;
    rect(image, x, 0, width, H, color);
    x += width;
  });
  return image;
}

function nordic(background, outer, inner) {
  const image = canvas(background);
  rect(image, 26, 0, inner ? 16 : 12, H, outer);
  rect(image, 0, 22, W, inner ? 20 : 12, outer);
  if (inner) {
    rect(image, 30, 0, 8, H, inner);
    rect(image, 0, 28, W, 8, inner);
  }
  return image;
}

const flags = {
  FR: () => vertical(['#0055A4', '#FFFFFF', '#EF4135']),
  GB: () => { const i = canvas('#012169'); line(i, 0, 0, W, H, 14, '#FFFFFF'); line(i, W, 0, 0, H, 14, '#FFFFFF'); line(i, 0, 0, W, H, 6, '#C8102E'); line(i, W, 0, 0, H, 6, '#C8102E'); rect(i, 38, 0, 20, H, '#FFFFFF'); rect(i, 0, 22, W, 20, '#FFFFFF'); rect(i, 44, 0, 8, H, '#C8102E'); rect(i, 0, 28, W, 8, '#C8102E'); return i; },
  ES: () => horizontal(['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]),
  DE: () => horizontal(['#000000', '#DD0000', '#FFCE00']),
  IT: () => vertical(['#009246', '#FFFFFF', '#CE2B37']),
  PT: () => { const i = vertical(['#046A38', '#DA291C'], [2, 3]); circle(i, 38, 32, 10, '#FFCD00'); return i; },
  NL: () => horizontal(['#AE1C28', '#FFFFFF', '#21468B']),
  PL: () => horizontal(['#FFFFFF', '#DC143C']),
  RU: () => horizontal(['#FFFFFF', '#0039A6', '#D52B1E']),
  CN: () => { const i = canvas('#DE2910'); star(i, 17, 16, 10, '#FFDE00'); return i; },
  JP: () => { const i = canvas('#FFFFFF'); circle(i, 48, 32, 16, '#BC002D'); return i; },
  KR: () => { const i = canvas('#FFFFFF'); circle(i, 48, 32, 14, '#CD2E3A'); circle(i, 52, 36, 10, '#0047A0'); line(i, 15, 16, 29, 8, 3, '#111111'); line(i, 67, 56, 81, 48, 3, '#111111'); return i; },
  SA: () => { const i = canvas('#006C35'); rect(i, 25, 22, 46, 4, '#FFFFFF'); rect(i, 30, 31, 36, 4, '#FFFFFF'); line(i, 24, 47, 72, 47, 4, '#FFFFFF'); return i; },
  IN: () => { const i = horizontal(['#FF9933', '#FFFFFF', '#138808']); circle(i, 48, 32, 8, '#000080'); circle(i, 48, 32, 6, '#FFFFFF'); circle(i, 48, 32, 2, '#000080'); return i; },
  TR: () => { const i = canvas('#E30A17'); circle(i, 40, 32, 16, '#FFFFFF'); circle(i, 46, 32, 13, '#E30A17'); star(i, 64, 32, 8, '#FFFFFF'); return i; },
  SE: () => nordic('#006AA7', '#FECC00'),
  VN: () => { const i = canvas('#DA251D'); star(i, 48, 32, 14, '#FFFF00'); return i; },
  TH: () => horizontal(['#A51931', '#FFFFFF', '#2D2A4A', '#FFFFFF', '#A51931'], [1, 1, 2, 1, 1]),
  GR: () => { const i = horizontal(['#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF']); rect(i, 0, 0, 38, 36, '#0D5EAF'); rect(i, 15, 0, 8, 36, '#FFFFFF'); rect(i, 0, 14, 38, 8, '#FFFFFF'); return i; },
  CZ: () => { const i = horizontal(['#FFFFFF', '#D7141A']); polygon(i, [[0, 0], [44, 32], [0, 64]], '#11457E'); return i; },
  RO: () => vertical(['#002B7F', '#FCD116', '#CE1126']),
  HU: () => horizontal(['#CE2939', '#FFFFFF', '#477050']),
  DK: () => nordic('#C60C30', '#FFFFFF'),
  FI: () => nordic('#FFFFFF', '#003580'),
  ID: () => horizontal(['#FF0000', '#FFFFFF']),
  NO: () => nordic('#BA0C2F', '#FFFFFF', '#00205B'),
  UA: () => horizontal(['#0057B7', '#FFD700']),
  CD: () => { const i = canvas('#007FFF'); line(i, -8, 64, 104, 0, 22, '#F7D618'); line(i, -8, 64, 104, 0, 12, '#CE1021'); star(i, 18, 16, 9, '#F7D618'); return i; },
  TZ: () => { const i = canvas('#1EB53A'); polygon(i, [[96, 0], [96, 64], [0, 64]], '#00A3DD'); line(i, -8, 64, 104, 0, 22, '#FCD116'); line(i, -8, 64, 104, 0, 14, '#000000'); return i; },
  SN: () => { const i = vertical(['#00853F', '#FDEF42', '#E31B23']); star(i, 48, 32, 10, '#00853F'); return i; },
  NG: () => vertical(['#008751', '#FFFFFF', '#008751']),
  IL: () => { const i = canvas('#FFFFFF'); rect(i, 0, 9, W, 6, '#0038B8'); rect(i, 0, 49, W, 6, '#0038B8'); const top = [[48, 19], [59, 39], [37, 39]]; const bottom = [[48, 45], [59, 25], [37, 25]]; for (const points of [top, bottom]) for (let n = 0; n < 3; n += 1) line(i, ...points[n], ...points[(n + 1) % 3], 2, '#0038B8'); return i; },
  TW: () => { const i = canvas('#FE0000'); rect(i, 0, 0, 48, 32, '#000095'); circle(i, 24, 16, 9, '#FFFFFF'); circle(i, 24, 16, 5, '#000095'); return i; },
  BD: () => { const i = canvas('#006A4E'); circle(i, 42, 32, 16, '#F42A41'); return i; },
};

fs.mkdirSync(out, { recursive: true });
for (const [region, render] of Object.entries(flags)) {
  fs.writeFileSync(path.join(out, `${region}.png`), PNG.sync.write(render(), { colorType: 2 }));
}
process.stdout.write(`Generated ${Object.keys(flags).length} native flag PNGs in ${out}\n`);
