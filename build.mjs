// SiberBoard production build:
//   - compile Tailwind utilities used in HTML + JS  -> dist/styles.css
//   - bundle + minify the ES modules                -> dist/app.js
//   - emit a production index.html (no CDN, hashed-free static refs)
//
// Runtime stays 100% static; Node is only needed at build time.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

// 1. clean output
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 2. Tailwind -> dist/styles.css (minified)
const twBin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss');
execFileSync(twBin, ['-i', 'src/input.css', '-o', 'dist/styles.css', '--minify'], {
  stdio: 'inherit',
  cwd: root,
});

// 3. bundle + minify JS -> dist/app.js
await build({
  entryPoints: [join(root, 'src', 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: join(dist, 'app.js'),
  legalComments: 'none',
});

// 4. content-hash each asset so the query string only changes when the file
//    changes — a stale browser cache busts on update, but unchanged files stay cached.
const hashOf = (file) => createHash('sha256').update(readFileSync(join(dist, file))).digest('hex').slice(0, 8);
const cssV = hashOf('styles.css');
const appV = hashOf('app.js');

// 5. production index.html: swap CDN script for compiled CSS, and replace the
//    dev bootstrap with the bundled app entry. The inline <style> block is kept as-is.
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html
  .replace(
    /\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/,
    `\n  <link rel="stylesheet" href="styles.css?v=${cssV}" />`,
  )
  .replace(
    /<script type="module" id="app-bootstrap">[\s\S]*?<\/script>/,
    `<script type="module">import "./app.js?v=${appV}";</script>`,
  );
writeFileSync(join(dist, 'index.html'), html);

// 6. copy optional static/SEO assets into dist if present
const copied = [];
for (const f of ['robots.txt', 'sitemap.xml', 'og-image.png', 'favicon.ico']) {
  if (existsSync(join(root, f))) {
    copyFileSync(join(root, f), join(dist, f));
    copied.push(f);
  }
}

console.log(`\n✓ Build complete → dist/  (deploy this folder)`);
console.log(`  styles.css?v=${cssV}   app.js?v=${appV}`);
if (copied.length) console.log(`  assets: ${copied.join(', ')}`);
if (!existsSync(join(root, 'og-image.png'))) {
  console.log(`  note: og-image.png belum ada — export dari og-image.svg agar preview sosial muncul.`);
}
