// Script one-shot per estrarre i path SVG dalle 48 icone lucide-react.
// Output: src/utils/lucideIconPaths.ts
// Esegui: node scripts/extract-lucide-paths.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const OUT_FILE = join(__dirname, '..', 'src', 'utils', 'lucideIconPaths.ts');

const WANTED = [
  'coffee', 'utensils', 'wine', 'pizza', 'cake',
  'chef-hat', 'drumstick', 'ice-cream-cone', 'apple', 'sandwich',
  'code', 'cpu', 'database', 'cloud', 'terminal',
  'server', 'smartphone', 'wifi', 'zap', 'layers',
  'shirt', 'scissors', 'sparkles', 'gem', 'crown',
  'watch', 'shopping-bag', 'palette', 'frame',
  'briefcase', 'building', 'scale', 'stethoscope', 'book-open',
  'graduation-cap', 'hammer', 'wrench', 'lightbulb', 'globe',
  'leaf', 'tree-pine', 'flower', 'mountain', 'sun',
  'moon', 'star', 'flame', 'waves',
];

function kebabToPascal(s) {
  return s.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function extractIcon(kebabName) {
  const pascal = kebabToPascal(kebabName);
  const file = join(ICONS_DIR, `${kebabName}.js`);
  const src = readFileSync(file, 'utf8');
  // Match: createLucideIcon("Name", [ ...children... ]);
  const bodyMatch = src.match(/createLucideIcon\(\s*"[^"]+"\s*,\s*(\[[\s\S]*?\]\s*)\)\s*;/);
  if (!bodyMatch) {
    throw new Error(`Could not parse icon ${kebabName}`);
  }
  return bodyMatch[1].trim();
}

const lines = [
  '// AUTO-GENERATED da scripts/extract-lucide-paths.mjs',
  '// Non modificare a mano. Le icone qui embeddate sono soggette a licenza ISC di lucide-react.',
  '// Mapping: nome-kebab (allowlist) -> frammento <path>/<circle>/<rect>/<line>/<polygon> children da passare a createElement.',
  '// Usato da logoGenerator.ts per renderizzare l\'icona lucide reale dentro la iconShape dell\'SVG esportato.',
  '',
  'export type LucideIconChildren = Array<[tag: string, attrs: Record<string, string | number>]>;',
  '',
  'export const LUCIDE_ICON_PATHS: Record<string, LucideIconChildren> = {',
];

for (const name of WANTED) {
  const children = extractIcon(name);
  lines.push(`  '${name}': ${children},`);
}

lines.push('};');
lines.push('');
lines.push(`export const LUCIDE_ICON_COUNT = ${WANTED.length};`);

writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
console.log(`Wrote ${WANTED.length} icons to ${OUT_FILE}`);
