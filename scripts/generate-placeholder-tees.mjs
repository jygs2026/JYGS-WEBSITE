/**
 * Generates DEMO PLACEHOLDER product artwork for the storefront:
 *   public/demo/tees/tee-<colour>-front.svg
 *   public/demo/tees/tee-<colour>-back-<graphic>.svg
 *
 * Original, brand-safe flat-lay illustrations of a boxy oversized tee in each JYGS colourway,
 * with a minimal front logo and a strong back graphic — so the demo catalogue reflects the
 * JYGS product direction without third-party logos, slogans or graphics.
 * Every image is captioned "PLACEHOLDER ARTWORK". Replace with real product photography.
 *
 * Run: node scripts/generate-placeholder-tees.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo", "tees");

// Keep in sync with colourDefs in src/mocks/catalog.ts.
const colours = {
  black: { fabric: "#151515", dark: true },
  "off-white": { fabric: "#EEE9DD", dark: false },
  white: { fabric: "#FAFAF7", dark: false },
  cherry: { fabric: "#7A1F2B", dark: true },
  "pine-green": { fabric: "#1F3B2E", dark: true },
  "me-lavender": { fabric: "#B8A9CF", dark: false },
  plum: { fabric: "#4A2340", dark: true },
};

const INK = "#141414";
const CREAM = "#EEE9DD";
const FONT = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";

// Boxy oversized silhouette: wide body, dropped shoulders, elbow-length sleeves.
const BODY =
  "M 370 190 C 400 240 500 240 530 190 L 705 230 L 860 470 L 750 535 L 715 470 L 715 960 Q 450 972 185 960 L 185 470 L 150 535 L 40 470 L 195 230 Z";
const BODY_BACK =
  "M 370 190 C 405 212 495 212 530 190 L 705 230 L 860 470 L 750 535 L 715 470 L 715 960 Q 450 972 185 960 L 185 470 L 150 535 L 40 470 L 195 230 Z";

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount));
  const b = clamp((n & 255) * (1 + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const backGraphics = {
  // Bold stacked wordmark with a rule and small caption.
  stack: (c) => `
    <text x="450" y="490" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="148" letter-spacing="8" textLength="440" lengthAdjust="spacingAndGlyphs" fill="${c}">JYGS</text>
    <rect x="310" y="522" width="280" height="5" fill="${c}"/>
    <text x="450" y="572" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="21" letter-spacing="7" textLength="400" lengthAdjust="spacing" fill="${c}">OVERSIZED · COMPACT COTTON</text>`,
  // Circular badge with text on a path and a central monogram.
  orbit: (c) => `
    <defs><path id="ring" d="M 450 382 a 158 158 0 1 1 -0.1 0"/></defs>
    <circle cx="450" cy="540" r="192" fill="none" stroke="${c}" stroke-width="7"/>
    <circle cx="450" cy="540" r="118" fill="none" stroke="${c}" stroke-width="3"/>
    <text font-family="${FONT}" font-weight="900" font-size="26" fill="${c}"><textPath href="#ring" textLength="980" lengthAdjust="spacing">JYGS • CLOTHING • JYGS • CLOTHING •</textPath></text>
    <text x="450" y="592" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="140" fill="${c}">J</text>`,
  // Four-letter monogram block inside a frame.
  monogram: (c) => `
    <rect x="300" y="390" width="300" height="300" fill="none" stroke="${c}" stroke-width="9"/>
    <line x1="450" y1="410" x2="450" y2="670" stroke="${c}" stroke-width="3"/>
    <line x1="320" y1="540" x2="580" y2="540" stroke="${c}" stroke-width="3"/>
    <text x="375" y="515" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="108" fill="${c}">J</text>
    <text x="525" y="515" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="108" fill="${c}">Y</text>
    <text x="375" y="665" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="108" fill="${c}">G</text>
    <text x="525" y="665" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="108" fill="${c}">S</text>`,
  // Repeating wordmark fading down the back.
  repeat: (c) =>
    [1, 0.78, 0.58, 0.4, 0.26, 0.15]
      .map(
        (o, i) =>
          `<text x="450" y="${375 + i * 84}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="88" letter-spacing="12" textLength="400" lengthAdjust="spacingAndGlyphs" fill="${c}" fill-opacity="${o}">JYGS</text>`,
      )
      .join(""),
};

function tee({ fabric, dark }, view, graphic) {
  const background = dark ? "#F1EFEA" : "#E3E0D8";
  const print = dark ? CREAM : INK;
  const body = view === "front" ? BODY : BODY_BACK;
  const neckInner =
    view === "front"
      ? `<path d="M 370 190 C 405 212 495 212 530 190 C 500 240 400 240 370 190 Z" fill="${shade(fabric, -0.28)}"/>
         <path d="M 370 190 C 400 240 500 240 530 190" fill="none" stroke="${shade(fabric, -0.12)}" stroke-width="16"/>`
      : `<path d="M 370 190 C 405 212 495 212 530 190" fill="none" stroke="${shade(fabric, -0.12)}" stroke-width="16"/>`;
  const fold = dark ? "#FFFFFF" : "#000000";
  const art =
    view === "front"
      ? `<text x="600" y="335" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="28" letter-spacing="6" fill="${print}">JYGS</text>`
      : backGraphics[graphic](print);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" width="900" height="1200">
  <defs>
    <linearGradient id="light" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.16"/>
      <stop offset="0.35" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#000" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.18"/>
    </filter>
    <clipPath id="shape"><path d="${body}"/></clipPath>
  </defs>
  <rect width="900" height="1200" fill="${background}"/>
  <path d="${body}" fill="${fabric}" filter="url(#shadow)"/>
  <g clip-path="url(#shape)">
    <rect width="900" height="1200" fill="url(#light)"/>
    <path d="M 190 935 Q 450 947 710 935" fill="none" stroke="${fold}" stroke-opacity="0.14" stroke-width="2" stroke-dasharray="6 6"/>
    <path d="M 838 492 L 740 551" fill="none" stroke="${fold}" stroke-opacity="0.14" stroke-width="2" stroke-dasharray="6 6"/>
    <path d="M 62 492 L 160 551" fill="none" stroke="${fold}" stroke-opacity="0.14" stroke-width="2" stroke-dasharray="6 6"/>
  </g>
  ${neckInner}
  ${art}
  <text x="862" y="64" text-anchor="end" font-family="Arial, sans-serif" font-weight="700" font-size="26" letter-spacing="4" fill="#6B675F">PLACEHOLDER</text>
  <text x="862" y="98" text-anchor="end" font-family="Arial, sans-serif" font-weight="700" font-size="26" letter-spacing="4" fill="#6B675F">ARTWORK</text>
</svg>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const [name, colour] of Object.entries(colours)) {
  writeFileSync(join(OUT_DIR, `tee-${name}-front.svg`), tee(colour, "front"));
  count++;
  for (const graphic of Object.keys(backGraphics)) {
    writeFileSync(join(OUT_DIR, `tee-${name}-back-${graphic}.svg`), tee(colour, "back", graphic));
    count++;
  }
}
console.log(`Generated ${count} placeholder tee SVGs in ${OUT_DIR}`);
