import type { PremiumQuote, QuoteItem, QuoteOption, DocumentTemplateId } from './quoteSchema';
import { calculateItemTotal, calculateOptionSummary, calculateGlobalTotals } from './quoteSchema';
import { setupPdfWorker } from './pdfWorkerSetup';
import Tesseract from 'tesseract.js';

export interface PdfTextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface PdfPageData {
  pageNum: number;
  textBlocks: PdfTextBlock[];
}

export interface PdfParseResult {
  pages: PdfPageData[];
  rawText: string;
  confidence: number;
}

function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function renderPageToCanvas(page: any, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function ocrPageWithTesseract(
  page: any,
  pageNum: number,
  scale: number,
  onProgress?: (page: number, progress: number) => void
): Promise<PdfPageData> {
  const canvas = await renderPageToCanvas(page, scale);
  const { data } = await Tesseract.recognize(canvas, 'ita+eng', {
    logger: (m: any) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(pageNum, m.progress || 0);
      }
    },
  });

  const textBlocks: PdfTextBlock[] = (data as any).words.map((w: any) => ({
    text: w.text,
    x: w.bbox.x0,
    y: w.bbox.y0,
    width: w.bbox.x1 - w.bbox.x0,
    height: w.bbox.y1 - w.bbox.y0,
    fontSize: 10,
  }));

  return {
    pageNum,
    textBlocks,
  };
}

export async function parsePDF(
  file: File,
  onOcrProgress?: (page: number, progress: number) => void
): Promise<PdfParseResult> {
  setupPdfWorker();

  const pdfjsLib = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: PdfPageData[] = [];
  const allTexts: string[] = [];
  const confidences: number[] = [];
  let needsOcr = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    const textBlocks: PdfTextBlock[] = textContent.items
      .filter((item: any) => item.str && item.str.trim())
      .map((item: any) => ({
        text: item.str,
        x: item.transform[4],
        y: viewport.height - item.transform[5],
        width: item.width,
        height: item.height || 0,
        fontSize: item.fontSize || 0,
      }));

    const pageText = textBlocks.map((b) => b.text).join(' ');
    allTexts.push(`--- Pagina ${i} ---\n${pageText}`);

    pages.push({ pageNum: i, textBlocks });
    confidences.push(0.8);

    // If page has very little text (< 100 chars), flag for OCR
    if (pageText.length < 100 && textContent.items.length > 0) {
      needsOcr = true;
    }
  }

  // Fall back to OCR if any page has sparse text (likely scanned PDF)
  if (needsOcr && onOcrProgress) {
    const ocrPages: PdfPageData[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const ocrResult = await ocrPageWithTesseract(page, i, 2, onOcrProgress);
      ocrPages.push(ocrResult);

      const ocrText = ocrResult.textBlocks.map((b) => b.text).join(' ');
      allTexts[i - 1] = `--- Pagina ${i} ---\n${ocrText}`;
    }

    return {
      pages: ocrPages,
      rawText: allTexts.join('\n\n'),
      confidence: 0.7,
    };
  }

  return {
    pages,
    rawText: allTexts.join('\n\n'),
    confidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.5,
  };
}

export function groupBlocksIntoLines(blocks: PdfTextBlock[]): string[] {
  const sorted = [...blocks].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) < 5) return a.x - b.x;
    return yDiff;
  });

  const lines: string[] = [];
  let currentLine: PdfTextBlock[] = [];
  let currentY = sorted[0]?.y;

  for (const block of sorted) {
    if (currentLine.length > 0 && Math.abs(block.y - currentY) > 4) {
      lines.push(currentLine.sort((a, b) => a.x - b.x).map((b) => b.text).join(' '));
      currentLine = [];
    }
    currentY = block.y;
    currentLine.push(block);
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.sort((a, b) => a.x - b.x).map((b) => b.text).join(' '));
  }

  return lines;
}

export function guessTableStructure(lines: string[]): { headers: string[]; rows: string[][] } {
  const numberPattern = /[\d.,]+\s*(€|EUR)?$/;
  const potentialTables = lines.filter((l) => l.split(/\s{2,}/).length >= 2 || numberPattern.test(l));

  if (potentialTables.length < 2) {
    return { headers: [], rows: [] };
  }

  const rows = potentialTables.map((l) => l.split(/\s{2,}/));
  const headers = rows[0] || [];
  return { headers, rows };
}

export function buildImportPrompt(parsed: PdfParseResult): string {
  return `Sei un assistente specializzato nell'estrarre dati da preventivi PDF.
Analizza il testo seguente e produci un JSON conforme allo schema del preventivo.

TESTO ESTRATTO DAL PDF:
${parsed.rawText}

Istruzioni:
1. Identifica: emittente (chi ha emesso il preventivo), cliente, titolo progetto, date, valuta
2. Estrai le opzioni commerciali con i relativi costi (voci, quantità, prezzi unitari, IVA)
3. Identifica eventuali clausole e condizioni
4. Per ogni campo di cui non sei sicuro, usa valore nullo o default
5. Rispondi SOLO con un JSON valido, senza commenti

Schema richiesto: un oggetto JSON con i campi del preventivo secondo lo standard dell'applicazione.
{
  "project": { "title": "...", "description": "..." },
  "client": { "name": "...", "contactPerson": null, "address": "...", "email": "..." },
  "issuer": { "name": "...", "vatNumber": null, "address": "...", "email": "..." },
  "options": [
    {
      "id": "opt_1",
      "label": "Opzione 1",
      "description": "...",
      "isDefault": true,
      "selectionType": "single",
      "items": [
        {
          "id": "item_1",
          "label": "Voce di costo",
          "category": "service",
          "unit": "fixed",
          "quantity": 1,
          "unitPrice": 1000,
          "discount": { "type": "none", "value": 0 },
          "tax": { "type": "vat", "rate": 22 }
        }
      ]
    }
  ],
  "legalClauses": [
    { "id": "clause_1", "title": "Titolo", "body": "Testo clausola", "language": "it" }
  ],
  "validUntil": "2026-07-19",
  "currency": "EUR",
  "locale": "it-IT",
  "paymentTerms": { "paymentMethod": "bonifico bancario" },
  "confidence": ${parsed.confidence}
}`;
}

export function reconstructQuoteFromAI(
  aiJson: Record<string, unknown>,
  parsed: PdfParseResult
): { quote: PremiumQuote; changes: string } {
  const now = new Date().toISOString();
  const vatRate = 22;

  const rawOptions = (aiJson.options || []) as any[];
  const options: QuoteOption[] = rawOptions.map((ro: any, i: number) => {
    const rawItems = (ro.items || []) as any[];
    const items: QuoteItem[] = rawItems.map((ri: any) => {
      const qty = Number(ri.quantity) || 1;
      const price = Number(ri.unitPrice) || 0;
      const rate = Number(ri.tax?.rate) || vatRate;
      const dType = ri.discount?.type || 'none';
      const dVal = Number(ri.discount?.value) || 0;
      return {
        id: ri.id || generateId('item'),
        label: ri.label || 'Voce',
        description: ri.description || '',
        category: ri.category || 'service',
        unit: ri.unit || 'fixed',
        quantity: qty,
        unitPrice: price,
        discount: { type: dType, value: dVal },
        tax: { type: 'vat', rate },
        total: calculateItemTotal(qty, price, dType, dVal, rate),
      };
    });
    const summary = calculateOptionSummary(items);
    return {
      id: ro.id || generateId('opt'),
      label: ro.label || `Opzione ${i + 1}`,
      description: ro.description || '',
      isDefault: i === 0,
      selectionType: ro.selectionType || 'single',
      items,
      summary,
    };
  });

  const globalTotals = calculateGlobalTotals(options, options.filter((o) => o.isDefault).map((o) => o.id));

  const rawClauses = (aiJson.legalClauses || []) as any[];
  const legalClauses = rawClauses.map((rc: any) => ({
    id: rc.id || generateId('clause'),
    title: rc.title || 'Clausola',
    body: rc.body || '',
    language: rc.language || 'it',
  }));

  const quote: PremiumQuote = {
    version: '1.0',
    quoteId: generateId('quote'),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    validUntil: (aiJson.validUntil as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: (aiJson.currency as string) || 'EUR',
    locale: (aiJson.locale as string) || 'it-IT',
    issuer: {
      name: ((aiJson.issuer as any)?.name as string) || '',
      vatNumber: ((aiJson.issuer as any)?.vatNumber as string) || null,
      taxCode: null,
      address: ((aiJson.issuer as any)?.address as string) || '',
      email: ((aiJson.issuer as any)?.email as string) || '',
      phone: '',
      website: null,
      logoUrl: null,
    },
    client: {
      name: ((aiJson.client as any)?.name as string) || '',
      contactPerson: ((aiJson.client as any)?.contactPerson as string) || null,
      address: ((aiJson.client as any)?.address as string) || '',
      email: ((aiJson.client as any)?.email as string) || '',
      phone: '',
      vatNumber: null,
      taxCode: null,
      notes: null,
    },
    project: {
      title: ((aiJson.project as any)?.title as string) || '',
      code: '',
      description: ((aiJson.project as any)?.description as string) || '',
      startDate: null,
      endDate: null,
    },
    importSource: {
      type: 'pdf',
      fileName: parsed.pages.length > 0 ? `pdf_import_${Date.now()}` : null,
      pages: parsed.pages.map((p) => p.pageNum),
      parsedAt: now,
      parser: 'pdfjs',
      confidence: parsed.confidence,
    },
    options,
    globalTotals,
    paymentTerms: {
      paymentMethod: ((aiJson.paymentTerms as any)?.paymentMethod as string) || 'bonifico bancario',
      paymentSchedule: [
        { label: 'Acconto', dueDaysFromIssue: 7, percentage: 50, notes: '' },
        { label: 'Saldo', dueDaysFromIssue: 30, percentage: 50, notes: '' },
      ],
      latePaymentInterest: '',
      iban: null,
      bic: null,
    },
    legalClauses,
    notes: { internal: '', clientVisible: '' },
    attachments: [],
    uiPreferences: {
      templateId: 'corporate' as DocumentTemplateId,
      accentColor: '#01696F',
      fontFamily: 'Inter',
      showLogo: true,
      showTotalsPerOption: true,
      showGlobalTotals: true,
    },
  };

  return {
    quote,
    changes: `Preventivo ricostruito da PDF con confidenza ${(parsed.confidence * 100).toFixed(0)}%. ${options.length} opzioni, ${legalClauses.length} clausole, ${options.reduce((s, o) => s + o.items.length, 0)} voci di costo.`,
  };
}
