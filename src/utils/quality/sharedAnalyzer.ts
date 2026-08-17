/**
 * Analyzer deterministico per card/flyer/logo (client-side, zero AI).
 * Pattern identico a siteAnalyser (website): ritorna { ok, issues[] }.
 * Ogni editor fornisce la propria funzione di analisi; qui ci sono i
 * controlli condivisi (testo vuoto, colori, contrasto).
 */

export interface AnalysisResult {
  ok: boolean;
  issues: string[];
}

const MAX_ISSUES = 8;

export function finishAnalysis(issues: string[]): AnalysisResult {
  return { ok: issues.length === 0, issues: issues.slice(0, MAX_ISSUES) };
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(color: string | undefined | null): boolean {
  return !!color && HEX_RE.test(color.trim());
}

/** Contrasto relativo WCAG (0..1) tra due colori hex. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const c = hex.replace('#', '');
    const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const v = parseInt(full.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function checkContrast(issues: string[], fg: string | undefined, bg: string | undefined, label: string): void {
  if (!fg || !bg || !isValidHex(fg) || !isValidHex(bg)) return;
  const ratio = contrastRatio(fg, bg);
  if (ratio < 3) {
    issues.push(`${label}: contrasto basso (${ratio.toFixed(1)}:1) tra ${fg} e ${bg}.`);
  }
}

export function checkEmptyText(issues: string[], value: string | undefined, label: string): void {
  if (!value || !value.trim()) {
    issues.push(`${label} è vuoto.`);
  }
}
