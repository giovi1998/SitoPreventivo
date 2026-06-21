import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pdfmake/build/pdfmake', () => {
  const createPdf = vi.fn(() => ({
    getBlob: vi.fn((cb: (blob: Blob) => void) => cb(new Blob(['%PDF-1.4\n'], { type: 'application/pdf' }))),
    getBuffer: vi.fn(() => Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]))),
    download: vi.fn(),
  }));
  const pdfMake = {
    vfs: {} as Record<string, string>,
    createPdf,
  };
  return { default: pdfMake };
});

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: { 'Roboto-Regular.ttf': 'AAEAAA...' },
}));

import generatePDF, { generatePDFBlob } from '../generatePDF';
import { createEmptyQuote } from '../quoteSchema';
import type { PremiumQuote } from '../quoteSchema';

const baseQuote: PremiumQuote = createEmptyQuote({
  quoteId: 'P-001',
  client: { ...createEmptyQuote().client, name: 'Mario Rossi' },
  project: { ...createEmptyQuote().project, description: 'Sito web vetrina' },
  options: [
    {
      id: 'opt1',
      label: 'Base',
      description: '',
      isDefault: true,
      selectionType: 'single',
      items: [
        {
          id: 'i1',
          label: 'Design',
          description: '',
          category: 'service',
          unit: 'piece',
          quantity: 1,
          unitPrice: 1000,
          discount: { type: 'none', value: 0 },
          tax: { type: 'vat', rate: 22 },
          total: { net: 1000, tax: 220, gross: 1220 },
        },
      ],
      summary: { subtotalNet: 1000, discountsTotal: 0, taxTotal: 220, totalNet: 1000, totalGross: 1220 },
    },
  ],
});

describe('generatePDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generatePDFBlob returns a Promise<Uint8Array>', async () => {
    const buf = await generatePDFBlob(baseQuote);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('generatePDFBlob accepts a custom themeId', async () => {
    const buf = await generatePDFBlob(baseQuote, 'minimal');
    expect(buf).toBeInstanceOf(Uint8Array);
  });

  it('generatePDF triggers download with the expected filename', async () => {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    generatePDF(baseQuote);
    expect(pdfMake.createPdf).toHaveBeenCalled();
    const created = (pdfMake.createPdf as any).mock.results[0].value;
    expect(created.download).toHaveBeenCalled();
    const call = (created.download as any).mock.calls[0][0];
    expect(call).toMatch(/\.pdf$/);
  });

  it('buildDocDefinition handles missing optional fields without throwing (regression)', async () => {
    const minimalQuote = createEmptyQuote();
    const buf = await generatePDFBlob(minimalQuote);
    expect(buf).toBeInstanceOf(Uint8Array);
  });

  it('buildDocDefinition accepts bold: true on text cells (typecheck regression)', async () => {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    generatePDFBlob(baseQuote);
    expect(createPdf).toHaveBeenCalled();
    const docDef = createPdf.mock.calls[0][0];
    expect(docDef).toBeDefined();
    expect(docDef.content).toBeDefined();
  });
});
