import { describe, it, expect } from 'vitest';
import {
  buildQrPayload,
  escapeVcard,
  escapeWifiValue,
  validateQrContrast,
  contrastRatio,
  generateQrSvg,
  generateQrPng,
  isHexColor,
  isHttpUrl,
  isAllowedLogoMime,
  ALLOWED_LOGO_MIME,
} from '../qrGenerator';
import { createEmptyQrCode } from '../documentSchemas';
import type { QRCode } from '../documentSchemas';

function baseQr(): QRCode {
  const qr = createEmptyQrCode();
  return { ...qr, data: { type: 'url', payload: 'https://example.com' } };
}

describe('qrGenerator - buildQrPayload', () => {
  it('returns URL unchanged', () => {
    expect(buildQrPayload({ type: 'url', payload: 'https://example.com' })).toBe('https://example.com');
  });

  it('returns text unchanged', () => {
    expect(buildQrPayload({ type: 'text', payload: 'hello world' })).toBe('hello world');
  });

  it('formats email with subject', () => {
    expect(buildQrPayload({ type: 'email', payload: 'a@b.com|Hello there' }))
      .toBe('mailto:a@b.com?subject=Hello%20there');
  });

  it('formats email without subject', () => {
    expect(buildQrPayload({ type: 'email', payload: 'a@b.com' })).toBe('mailto:a@b.com');
  });

  it('formats phone as tel:', () => {
    expect(buildQrPayload({ type: 'phone', payload: '+393331234567' })).toBe('tel:+393331234567');
  });

  it('formats sms as SMSTO:', () => {
    expect(buildQrPayload({ type: 'sms', payload: '+393331234567|Ciao' })).toBe('SMSTO:+393331234567:Ciao');
  });

  it('formats wifi WPA', () => {
    expect(buildQrPayload({ type: 'wifi', payload: 'MyNet|secret123|WPA' }))
      .toBe('WIFI:T:WPA;S:MyNet;P:secret123;;');
  });

  it('formats wifi nopass (no password field)', () => {
    expect(buildQrPayload({ type: 'wifi', payload: 'MyNet||nopass' }))
      .toBe('WIFI:T:nopass;S:MyNet;;');
  });

  it('escapes semicolons in wifi SSID', () => {
    expect(buildQrPayload({ type: 'wifi', payload: 'My;Network|pass|WPA' }))
      .toContain('S:My\\;Network');
  });

  it('returns vcard payload unchanged (caller responsibility)', () => {
    expect(buildQrPayload({ type: 'vcard', payload: 'BEGIN:VCARD\nFN:Giovanni\nEND:VCARD' }))
      .toBe('BEGIN:VCARD\nFN:Giovanni\nEND:VCARD');
  });
});

describe('qrGenerator - escapeVcard', () => {
  it('escapes backslash first', () => {
    expect(escapeVcard('a\\b')).toBe('a\\\\b');
  });

  it('escapes newlines as \\n', () => {
    expect(escapeVcard('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes commas and semicolons', () => {
    expect(escapeVcard('a,b;c')).toBe('a\\,b\\;c');
  });

  it('handles combined inputs (Müller & Sons)', () => {
    expect(escapeVcard('Müller & Sons')).toBe('Müller & Sons');
  });
});

describe('qrGenerator - escapeWifiValue', () => {
  it('escapes backslash, semicolon, colon, comma, double-quote', () => {
    expect(escapeWifiValue('a\\b;c:d,e"f')).toBe('a\\\\b\\;c\\:d\\,e\\"f');
  });
});

describe('qrGenerator - validateQrContrast', () => {
  it('passes for black on white', () => {
    expect(validateQrContrast('#000000', '#FFFFFF')).toBe(true);
  });

  it('fails for same color', () => {
    expect(validateQrContrast('#888888', '#888888')).toBe(false);
  });

  it('fails for light gray on white', () => {
    expect(validateQrContrast('#EEEEEE', '#FFFFFF')).toBe(false);
  });

  it('contrastRatio returns expected value for black/white', () => {
    const ratio = contrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeGreaterThan(20);
    expect(ratio).toBeLessThan(22);
  });
});

describe('qrGenerator - SVG/PNG generation', () => {
  it('generateQrSvg returns valid SVG with viewBox', async () => {
    const qr = baseQr();
    const svg = await generateQrSvg(qr);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('</svg>');
  });

  it('generateQrPng returns a non-empty Uint8Array', async () => {
    const qr = baseQr();
    const bytes = await generateQrPng(qr);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // PNG magic number: 89 50 4E 47
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it('generateQrSvg respects fgColor', async () => {
    const qr = { ...baseQr(), style: { ...baseQr().style, fgColor: '#ff0000' } };
    const svg = await generateQrSvg(qr);
    expect(svg.toLowerCase()).toContain('#ff0000');
  });

  it('generateQrSvg with logoOverlay injects an <image> tag', async () => {
    const qr = { ...baseQr(), style: { ...baseQr().style, logoOverlay: 'data:image/png;base64,AAAA' } };
    const svg = await generateQrSvg(qr);
    expect(svg).toContain('<image');
  });
});

describe('qrGenerator - dotStyle rendering', () => {
  it('square style emits <rect> modules without rx', async () => {
    const qr = { ...baseQr(), style: { ...baseQr().style, dotStyle: 'square' as const } };
    const svg = await generateQrSvg(qr);
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('<circle');
    expect(svg).not.toContain('rx=');
  });

  it('rounded style emits <rect> with rx/ry', async () => {
    const qr = { ...baseQr(), style: { ...baseQr().style, dotStyle: 'rounded' as const } };
    const svg = await generateQrSvg(qr);
    expect(svg).toContain('<rect');
    expect(svg).toContain('rx="0.35"');
    expect(svg).not.toContain('<circle');
  });

  it('dots style emits <circle> modules', async () => {
    const qr = { ...baseQr(), style: { ...baseQr().style, dotStyle: 'dots' as const } };
    const svg = await generateQrSvg(qr);
    expect(svg).toContain('<circle');
    const circles = svg.match(/<circle/g) || [];
    expect(circles.length).toBeGreaterThan(0);
  });

  it('different dotStyles produce structurally different SVG', async () => {
    const base = baseQr();
    const square = { ...base, style: { ...base.style, dotStyle: 'square' as const } };
    const rounded = { ...base, style: { ...base.style, dotStyle: 'rounded' as const } };
    const dots = { ...base, style: { ...base.style, dotStyle: 'dots' as const } };
    const [s1, s2, s3] = await Promise.all([generateQrSvg(square), generateQrSvg(rounded), generateQrSvg(dots)]);
    expect(s1).not.toBe(s2);
    expect(s2).not.toBe(s3);
    expect(s1).not.toBe(s3);
  });

  it('respects fgColor on rendered modules', async () => {
    const qr = { ...baseQr(), style: { ...baseQr().style, fgColor: '#ff00ff' } };
    const svg = await generateQrSvg(qr);
    expect(svg.toLowerCase()).toContain('#ff00ff');
  });

  it('emits empty SVG for empty payload', async () => {
    const qr = createEmptyQrCode();
    const svg = await generateQrSvg(qr);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

describe('qrGenerator - validators', () => {
  it('isHexColor accepts 6-digit hex', () => {
    expect(isHexColor('#abcdef')).toBe(true);
    expect(isHexColor('#ABCDEF')).toBe(true);
  });

  it('isHexColor rejects malformed colors', () => {
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#abc')).toBe(false);
    expect(isHexColor('#abcdef00')).toBe(false);
  });

  it('isHttpUrl accepts http and https', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('isHttpUrl rejects other protocols', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/plain,foo')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('example.com')).toBe(false);
  });

  it('isAllowedLogoMime accepts PNG, JPEG, SVG', () => {
    expect(isAllowedLogoMime('image/png')).toBe(true);
    expect(isAllowedLogoMime('image/jpeg')).toBe(true);
    expect(isAllowedLogoMime('image/svg+xml')).toBe(true);
  });

  it('isAllowedLogoMime rejects other MIMEs', () => {
    expect(isAllowedLogoMime('application/octet-stream')).toBe(false);
    expect(isAllowedLogoMime('text/html')).toBe(false);
  });

  it('ALLOWED_LOGO_MIME is the canonical allowlist', () => {
    expect(ALLOWED_LOGO_MIME).toEqual(['image/png', 'image/jpeg', 'image/svg+xml']);
  });
});
