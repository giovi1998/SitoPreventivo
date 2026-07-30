// TB-027 B5: SVG swatch card per preview palette. Zero costo AI, render puro.
import type { PaletteConcept } from '../ai/PaletteOrchestrator';
import { escapeXml } from './xml';

export function buildPaletteSvg(concept: PaletteConcept): string {
  const swatches: Array<{ color: string; label: string }> = [
    { color: concept.primary, label: 'Primary' },
    { color: concept.secondary, label: 'Secondary' },
    { color: concept.accent, label: 'Accent' },
    { color: concept.bg, label: 'Bg' },
    { color: concept.text, label: 'Text' },
  ];
  const swatchW = 56;
  const gap = 4;
  const startX = 12;
  const y = 38;
  const labelY = 92;
  const dots = swatches
    .map((s, i) => {
      const x = startX + i * (swatchW + gap);
      return `<rect x="${x}" y="${y}" width="${swatchW}" height="${swatchW}" rx="8" fill="${s.color}"/><text x="${x + swatchW / 2}" y="${labelY}" font-family="Inter,sans-serif" font-size="9" fill="#6b7280" text-anchor="middle">${s.label}</text>`;
    })
    .join('');
  const rationale = (concept.rationale || '').slice(0, 70);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120">
  <rect width="320" height="120" rx="12" fill="#fff" stroke="#e5e7eb"/>
  <text x="12" y="22" font-family="Inter,sans-serif" font-size="14" font-weight="700" fill="#111">${escapeXml(concept.name)}</text>
  ${dots}
  <text x="12" y="110" font-family="Inter,sans-serif" font-size="10" fill="#6b7280">${escapeXml(rationale)}</text>
</svg>`;
}

export function palettePreviewDataUrl(concept: PaletteConcept): string {
  const svg = buildPaletteSvg(concept);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}