// Copies the self-hosted libraries and fonts from node_modules into theme/assets.
// Run after `npm install` when bumping GSAP, Lenis or the Archivo fonts.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const map = [
  ['node_modules/gsap/dist/gsap.min.js', 'gsap.min.js'],
  ['node_modules/gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
  ['node_modules/gsap/dist/SplitText.min.js', 'SplitText.min.js'],
  ['node_modules/lenis/dist/lenis.min.js', 'lenis.min.js'],
  ['node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2', 'archivo-black-latin.woff2'],
  ['node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', 'archivo-latin-wght.woff2'],
];

for (const [from, to] of map) {
  const dest = `theme/assets/${to}`;
  copyFileSync(from, dest);
  if (to.endsWith('.js')) {
    // Source maps are not shipped, so drop the dangling reference.
    const src = readFileSync(dest, 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, '');
    writeFileSync(dest, src);
  }
  console.log(`✓ ${to}`);
}
