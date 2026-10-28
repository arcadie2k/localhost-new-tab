'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'assets', 'icons');
const outDir = path.join(root, 'extension', 'icons');
fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const PALETTE = {
  top: '#2b2b2f',
  mid: '#1c1c1f',
  bottom: '#121214',
};

const U = 96;
const CORNER = 27;
const TILE_CORNER = CORNER - 18;

function layout(size) {
  return size <= 16 ? { A: 12, T: 30, G: 12 } : { A: 18, T: 27, G: 6 };
}

function squircle(x, y, w, h, e, n = 4, steps = 24) {
  const pts = [];
  const corner = (cx, cy, sx, sy, from, to) => {
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      const px = cx + sx * e * Math.pow(Math.abs(Math.cos(t)), 2 / n);
      const py = cy + sy * e * Math.pow(Math.abs(Math.sin(t)), 2 / n);
      pts.push(`${px.toFixed(3)} ${py.toFixed(3)}`);
    }
  };
  const q = Math.PI / 2;
  corner(x + e, y + e, -1, -1, 0, q);
  corner(x + w - e, y + e, 1, -1, q, 0);
  corner(x + w - e, y + h - e, 1, 1, 0, q);
  corner(x + e, y + h - e, -1, 1, q, 0);
  return `M${pts.join('L')}Z`;
}

function tiles({ glass, stroke, A, T, G }) {
  const B = A + T + G;
  const hollow = (x, y) =>
    `<path d="${squircle(x + stroke / 2, y + stroke / 2, T - stroke, T - stroke, TILE_CORNER - stroke / 2)}"
      fill="${glass ? 'url(#frost)' : 'none'}" stroke="${glass ? 'url(#rim)' : '#fff'}" stroke-width="${stroke}"/>`;
  const litPath = squircle(A, A, T, T, TILE_CORNER);
  const others = `${hollow(B, A)}${hollow(A, B)}${hollow(B, B)}`;
  if (!glass) return `<path d="${litPath}" fill="#fff"/>${others}`;
  return `<path d="${litPath}" fill="#fff" opacity="0.28" filter="url(#bloom)"/>
    <g filter="url(#lift)">${others}</g>
    <path d="${litPath}" fill="url(#solid)"/>
    <path d="${litPath}" fill="url(#shine)"/>
    <path d="${squircle(A + 0.25, A + 0.25, T - 0.5, T - 0.5, TILE_CORNER - 0.25)}" fill="none" stroke="url(#solidRim)" stroke-width="0.5"/>`;
}

function icon(size, inset, { detail }) {
  const s = size - inset * 2;
  const k = s / U;
  const stroke = detail ? (s <= 48 ? 1.8 : s <= 96 ? 1.4 : 1.2) : s <= 16 ? 6 : 3;
  const boost = detail && s <= 48 ? 1.3 : 1;
  const geo = layout(s);
  const grainFreq = (0.9 * k).toFixed(3);
  const outline = squircle(0, 0, U, U, CORNER);
  const lx = geo.A + geo.T / 2;
  const o = (v) => Math.min(1, v * boost).toFixed(3);

  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PALETTE.top}"/>
      <stop offset="0.55" stop-color="${PALETTE.mid}"/>
      <stop offset="1" stop-color="${PALETTE.bottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.22" cy="0.12" r="0.75">
      <stop offset="0" stop-color="#fff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="edge" gradientUnits="userSpaceOnUse" cx="14" cy="10" r="70">
      <stop offset="0" stop-color="#fff" stop-opacity="0.42"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="edgeCounter" gradientUnits="userSpaceOnUse" cx="86" cy="90" r="40">
      <stop offset="0" stop-color="#fff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="solid" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e2e6ef"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.7"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="solidRim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="frost" gradientUnits="userSpaceOnUse" cx="${lx}" cy="${lx}" r="70">
      <stop offset="0.25" stop-color="#fff" stop-opacity="${o(0.2)}"/>
      <stop offset="1" stop-color="#fff" stop-opacity="${o(0.04)}"/>
    </radialGradient>
    <radialGradient id="rim" gradientUnits="userSpaceOnUse" cx="${lx}" cy="${lx}" r="70">
      <stop offset="0.25" stop-color="#fff" stop-opacity="${o(0.95)}"/>
      <stop offset="0.42" stop-color="#fff" stop-opacity="${o(0.6)}"/>
      <stop offset="0.65" stop-color="#fff" stop-opacity="${o(0.2)}"/>
      <stop offset="1" stop-color="#fff" stop-opacity="${o(0.1)}"/>
    </radialGradient>
    <filter id="bloom" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <clipPath id="shape"><path d="${outline}"/></clipPath>
    <filter id="lift" x="-20%" y="-20%" width="140%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.4"/>
      <feOffset dy="1.2" result="blur"/>
      <feFlood flood-color="#000" flood-opacity="0.3"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${grainFreq}" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.9"/>
      </feComponentTransfer>
    </filter>`;

  const rimPath = squircle(0.2, 0.2, U - 0.4, U - 0.4, CORNER - 0.2);
  const body = detail
    ? `<g clip-path="url(#shape)">
        <rect width="${U}" height="${U}" fill="url(#bg)"/>
        <rect width="${U}" height="${U}" fill="url(#glow)"/>
        <rect width="${U}" height="${U}" filter="url(#grain)" opacity="0.14"/>
        <rect width="${U}" height="${U * 0.5}" fill="url(#sheen)"/>
        ${tiles({ glass: true, stroke, ...geo })}
      </g>
      <path d="${rimPath}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="0.6"/>
      <path d="${rimPath}" fill="none" stroke="url(#edge)" stroke-width="0.4"/>
      <path d="${rimPath}" fill="none" stroke="url(#edgeCounter)" stroke-width="0.4"/>`
    : `<path d="${outline}" fill="url(#bg)"/>
      ${s > 16 ? `<path d="${squircle(1.5, 1.5, U - 3, U - 3, CORNER - 1.5)}" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="3"/>` : ''}
      ${tiles({ glass: false, stroke, ...geo })}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${defs}
  </defs>
  <g transform="translate(${inset} ${inset}) scale(${k})">
    ${body}
  </g>
</svg>
`;
}

fs.writeFileSync(path.join(srcDir, 'icon512.svg'), icon(512, 0, { detail: true }));
const master = path.join(srcDir, 'icon1024.png');
execFileSync('rsvg-convert', ['-w', '1024', '-h', '1024', path.join(srcDir, 'icon512.svg'), '-o', master]);

for (const f of fs.readdirSync(srcDir)) {
  if (/^icon(16|32|48|128)\.svg$/.test(f)) fs.rmSync(path.join(srcDir, f));
}

const sizes = [
  { size: 16, art: 16 },
  { size: 32, art: 32 },
  { size: 48, art: 48 },
  { size: 128, art: 96 },
];

for (const { size, art } of sizes) {
  execFileSync('magick', [
    master, '-filter', 'Lanczos', '-resize', `${art}x${art}`,
    ...(art <= 32 ? ['-unsharp', '0x0.6+0.6+0'] : []),
    '-background', 'none', '-gravity', 'center', '-extent', `${size}x${size}`,
    path.join(outDir, `icon${size}.png`),
  ]);
}
console.log('icons written to', path.relative(root, outDir));
