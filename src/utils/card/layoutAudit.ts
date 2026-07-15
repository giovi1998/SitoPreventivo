/**
 * Layout audit: compare an exported SVG against expected structure for the
 * given card snapshot. Returns hard findings (error/warn) so e2e/unit tests
 * can fail on layout drift, not only on "download non-empty".
 *
 * All ratios are computed in user units (viewBox) so they remain stable at
 * any export resolution.
 */
import type { BusinessCard } from '../documentSchemas';
import { parseCardSvg, type ParsedCardSvg } from '../../../e2e/helpers/cardHarness';

export type AuditFindingCode =
  | 'FONT_RATIO_KEY'
  | 'FONT_RATIO_VALUE'
  | 'FONT_RATIO_SOCIAL'
  | 'LABEL_VALUE_OVERLAP'
  | 'LOGO_TOO_SMALL'
  | 'QR_POSITION'
  | 'MISSING_TEXT'
  | 'GHOST_GAP'
  | 'HEADER_MISSING'
  | 'EXPORT_EMPTY';

export interface AuditFinding {
  code: AuditFindingCode;
  severity: 'error' | 'warn';
  message: string;
  metrics?: Record<string, number>;
}

export interface AuditResult {
  ok: boolean;
  findings: AuditFinding[];
}

function findText(parsed: ParsedCardSvg, text: string) {
  return parsed.texts.find((t) => t.text.includes(text)) ?? null;
}

export function auditExportSvg(side: 'front' | 'back', svg: string, card: BusinessCard): AuditResult {
  const findings: AuditFinding[] = [];
  const parsed = parseCardSvg(svg);
  const { width: W, height: H } = parsed;

  if (W === 0 || H === 0) {
    findings.push({ code: 'EXPORT_EMPTY', severity: 'error', message: 'SVG has no viewBox' });
    return { ok: false, findings };
  }

  if (side === 'front') {
    const name = findText(parsed, card.front.name || 'MARIO ROSSI');
    if (!name) findings.push({ code: 'MISSING_TEXT', severity: 'error', message: 'Front export missing name text' });

    const nonPhotoImages = parsed.images.filter((i) => !i.href.includes('photo') && !i.href.includes('giovanni-photo'));
    const logo = nonPhotoImages.sort((a, b) => b.width - a.width)[0];
    if (logo) {
      const ratio = logo.width / W;
      if (ratio < 0.35) {
        findings.push({
          code: 'LOGO_TOO_SMALL',
          severity: 'error',
          message: `Logo width ratio ${ratio.toFixed(2)} is below 0.35 (60% shrink regression)`,
          metrics: { logoWidthRatio: ratio },
        });
      }
    }
    return { ok: !findings.some((f) => f.severity === 'error'), findings };
  }

  // back
  const hasHeader = parsed.texts.some((t) => t.text.includes('CONTATTI'));
  if (!hasHeader && (card.back.phone || card.back.email || card.back.website || card.back.address || card.back.vatNumber)) {
    findings.push({ code: 'HEADER_MISSING', severity: 'warn', message: 'Back export missing CONTACTS header' });
  }

  const phoneKey = findText(parsed, 'TELEFONO');
  if (!phoneKey) {
    findings.push({ code: 'MISSING_TEXT', severity: 'error', message: 'Back export missing TELEFONO key' });
  } else {
    const keyRatio = phoneKey.fontSize / H;
    if (keyRatio < 0.015) {
      findings.push({ code: 'FONT_RATIO_KEY', severity: 'error', message: `TELEFONO font ratio ${keyRatio.toFixed(3)} too small`, metrics: { keyRatio } });
    }
    if (keyRatio > 0.04) {
      findings.push({ code: 'FONT_RATIO_KEY', severity: 'error', message: `TELEFONO font ratio ${keyRatio.toFixed(3)} too large`, metrics: { keyRatio } });
    }
  }

  const emailVal = findText(parsed, (card.back.email || 'webdevcaglian').split('@')[0]);
  if (emailVal) {
    const valRatio = emailVal.fontSize / H;
    if (valRatio > 0.05) {
      findings.push({ code: 'FONT_RATIO_VALUE', severity: 'error', message: `Email value font ratio ${valRatio.toFixed(3)} too large`, metrics: { valRatio } });
    }
  }

  const socialText = card.back.socials.filter((s) => s.platform && s.url).map((s) => s.platform).join('   ');
  if (socialText) {
    const social = parsed.texts.find((t) => card.back.socials.some((s) => t.text.includes(s.platform)));
    if (!social) {
      findings.push({ code: 'MISSING_TEXT', severity: 'error', message: 'Back export missing socials text' });
    } else {
      const socialRatio = social.fontSize / H;
      if (socialRatio < 0.012) {
        findings.push({ code: 'FONT_RATIO_SOCIAL', severity: 'error', message: `Social font ratio ${socialRatio.toFixed(3)} too small`, metrics: { socialRatio } });
      }
      if (socialRatio > 0.04) {
        findings.push({ code: 'FONT_RATIO_SOCIAL', severity: 'error', message: `Social font ratio ${socialRatio.toFixed(3)} too large`, metrics: { socialRatio } });
      }
    }
  }

  // Label/value overlap check: all keys must sit to the left of their values
  // (tolerance 2 user units for side-bearing).
  const labelTexts = ['TELEFONO', 'EMAIL', 'WEB', 'INDIRIZZO', 'P.IVA'];
  for (const key of labelTexts) {
    const label = findText(parsed, key);
    if (!label || !label.anchor) continue;
    if (label.anchor !== 'start') continue; // right-aligned labels flip the rule
    // estimate label width: uppercase sans ~0.62em per char + letter-spacing 0.4em
    const estLabelW = label.fontSize * (key.length * 0.62 + 0.4);
    const minValueX = label.x + estLabelW;
    const value = parsed.texts.find((t) => {
      if (t === label) return false;
      // same horizontal band
      return Math.abs(t.y - label.y) < label.fontSize * 1.2;
    });
    if (value && value.x < minValueX - 2) {
      findings.push({
        code: 'LABEL_VALUE_OVERLAP',
        severity: 'error',
        message: `Label ${key} may overlap value (labelEnd=${minValueX.toFixed(1)}, valueX=${value.x.toFixed(1)})`,
        metrics: { labelEnd: minValueX, valueX: value.x },
      });
    }
  }

  const qr = parsed.qrRects[0];
  if (qr) {
    if (qr.x <= W * 0.4) {
      findings.push({ code: 'QR_POSITION', severity: 'warn', message: `QR x ratio ${(qr.x / W).toFixed(2)} is not on the right half`, metrics: { qrXRatio: qr.x / W } });
    }
    const qrRatio = qr.width / H;
    if (qrRatio < 0.15 || qrRatio > 0.55) {
      findings.push({ code: 'QR_POSITION', severity: 'error', message: `QR size ratio ${qrRatio.toFixed(2)} outside [0.15, 0.55]`, metrics: { qrRatio } });
    }
  }

  return { ok: !findings.some((f) => f.severity === 'error'), findings };
}

export function filterFindingsBySeverity(result: AuditResult, severity: 'error' | 'warn'): AuditFinding[] {
  return result.findings.filter((f) => f.severity === severity);
}

export function hasFindingCode(result: AuditResult, code: AuditFindingCode): boolean {
  return result.findings.some((f) => f.code === code);
}
