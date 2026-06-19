import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { PremiumQuote, DocumentTemplateId } from './quoteSchema';
import { getPdfMakeStyle } from './documentThemes';

if (pdfFonts.pdfMake) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
} else {
  pdfMake.vfs = pdfFonts.vfs || pdfFonts;
}

const money = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));

export default function generatePDF(quote: PremiumQuote, themeId: DocumentTemplateId = 'corporate') {
  const theme = getPdfMakeStyle(themeId);
  const accent = quote.uiPreferences?.accentColor || '#01696F';
  const opts = quote.options || [];
  const vat = opts[0]?.items[0]?.tax?.rate || 22;
  const content: any[] = [];

  // ─── TITLE ───────────────────────────────────────────
  content.push({
    text: quote.project?.title || 'PREVENTIVO',
    style: 'mainTitle',
    color: accent,
  });
  content.push({ text: '' });

  content.push({
    table: {
      widths: ['*'],
      body: [
        [{ text: `Cliente: ${quote.client?.name || '_________'}`, style: 'clientInfo' }],
        [{ text: `Data: ${(quote.createdAt || '').slice(0, 10) || '_________'}`, style: 'clientInfo' }],
        [{ text: `Preparato da: ${quote.issuer?.name || ''}`, style: 'clientInfo' }],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 16],
  });

  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: theme.colors.border }], margin: [0, 0, 0, 16] });

  if (quote.project?.description) {
    content.push({
      text: quote.project.description.split('\n').filter(Boolean).map((l: string) => ({ text: l, style: 'introText' })),
      margin: [0, 0, 0, 16],
    });
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: theme.colors.border }], margin: [0, 0, 0, 8] });
  }

  // ─── OPTIONS ─────────────────────────────────────────
  opts.forEach((option, idx) => {
    if (idx > 0) content.push({ text: '', pageBreak: 'before' });

    content.push({
      text: option.label,
      style: 'optionTitle',
      color: accent,
      margin: [0, 0, 0, 8],
    });

    if (option.description) {
      content.push({
        text: [{ text: 'Descrizione del progetto\n', bold: true }, option.description || ''],
        style: 'optionDesc',
        margin: [0, 0, 0, 12],
      });
    }

    const items = option.items || [];
    if (items.length > 0) {
      content.push({ text: 'Costi', style: 'tableLabel', margin: [0, 8, 0, 4] });
      const costHeader = ['Voce', 'Q.tà', 'Prezzo', 'Totale'].map((h) => ({
        text: h, style: 'tableHeader', alignment: (h === 'Voce' ? 'left' : 'right') as any,
      }));
      const costRows = [costHeader];
      items.forEach((item) => {
        costRows.push([
          { text: item.label },
          { text: `${item.quantity} ${item.unit}`, alignment: 'right' as any },
          { text: money(item.unitPrice), alignment: 'right' as any },
          { text: money(item.total?.gross || 0), alignment: 'right' as any, bold: true },
        ]);
      });
      content.push({
        table: { widths: ['*', 'auto', 'auto', 'auto'], body: costRows },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12],
      });

      content.push({ text: 'Riepilogo economico', style: 'tableLabel', margin: [0, 4, 0, 4] });
      const sumHeader = ['Voce', 'Imponibile', `IVA ${vat}%`, 'Totale IVA inclusa'].map((h) => ({
        text: h, style: 'tableHeader', alignment: (h === 'Voce' ? 'left' : 'right') as any,
      }));
      const sumRows = [sumHeader];
      items.forEach((item) => {
        sumRows.push([
          { text: item.label },
          { text: money(item.total?.net || 0), alignment: 'right' as any },
          { text: money(item.total?.tax || 0), alignment: 'right' as any },
          { text: money(item.total?.gross || 0), alignment: 'right' as any, bold: true },
        ]);
      });
      sumRows.push([
        { text: 'Totale opzione', bold: true },
        { text: money(option.summary?.totalNet || 0), alignment: 'right' as any, bold: true },
        { text: money(option.summary?.taxTotal || 0), alignment: 'right' as any, bold: true },
        { text: money(option.summary?.totalGross || 0), alignment: 'right' as any, bold: true },
      ]);
      content.push({
        table: { widths: ['*', 'auto', 'auto', 'auto'], body: sumRows },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12],
      });
    }

    if (quote.paymentTerms?.paymentSchedule?.length > 0) {
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: theme.colors.border }],
        margin: [0, 4, 0, 4],
      });
      quote.paymentTerms.paymentSchedule.forEach((ps) => {
        content.push({
          text: [
            { text: `${ps.label} (${ps.percentage}%): `, bold: true },
            { text: money((option.summary?.totalGross || 0) * ps.percentage / 100), color: accent, bold: true },
            { text: ` IVA inclusa — ${ps.notes || `Entro ${ps.dueDaysFromIssue} giorni`}` },
          ],
          style: 'accontoText',
          margin: [0, 0, 0, 4],
        });
      });
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: theme.colors.border }],
        margin: [0, 0, 0, 0],
      });
    }
  });

  // ─── CLAUSES ─────────────────────────────────────────
  if (quote.legalClauses?.length > 0) {
    content.push({ text: '', pageBreak: 'before' });
    content.push({ text: 'CLAUSOLE E CONDIZIONI GENERALI', style: 'sectionTitle', margin: [0, 0, 0, 12] });

    quote.legalClauses.forEach((clause) => {
      content.push({
        text: [
          { text: clause.title + '\n', bold: true },
          { text: clause.body || '', color: '#39465b' },
        ],
        style: 'clauseText',
        margin: [0, 0, 0, 10],
      });
    });
  }

  // ─── COMPARISON ──────────────────────────────────────
  if (opts.length > 1) {
    content.push({ text: '', pageBreak: 'before' });
    content.push({ text: 'RIEPILOGO COMPARATIVO', style: 'sectionTitle', margin: [0, 0, 0, 12] });

    const compHeader = [
      { text: 'Caratteristica', style: 'tableHeader' },
      ...opts.map((o) => ({ text: o.label.split('—')[0].trim(), style: 'tableHeader' })),
    ];

    const compRows = [
      compHeader,
      [
        { text: 'Totale NET', bold: true },
        ...opts.map((o) => ({ text: money(o.summary?.totalNet || 0) })),
      ],
      [
        { text: 'Totale IVA', bold: true },
        ...opts.map((o) => ({ text: money(o.summary?.taxTotal || 0) })),
      ],
      [
        { text: 'Totale IVA inclusa', bold: true },
        ...opts.map((o) => ({ text: money(o.summary?.totalGross || 0), bold: true })),
      ],
    ];

    content.push({
      table: { widths: [130, ...opts.map(() => '*')], body: compRows },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 24],
    });
  }

  // ─── FOOTER ──────────────────────────────────────────
  content.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: theme.colors.border }],
    margin: [0, 0, 0, 8],
  });
  content.push({
    columns: [
      { text: quote.issuer?.name || '', width: '*', style: 'footerText' as any },
      { text: `Preventivo valido fino al ${quote.validUntil || '30 giorni'}`, width: 'auto', style: 'footerText' as any, alignment: 'right' as any },
    ],
  });

  const docDefinition: any = {
    content,
    defaultStyle: theme.defaultStyle,
    styles: {
      mainTitle: { fontSize: 22, bold: true, margin: [0, 0, 0, 4] },
      clientInfo: { fontSize: 10, color: theme.colors.muted, margin: [0, 2, 0, 2] },
      introText: { fontSize: 9.5, color: theme.colors.muted, lineHeight: 1.5 },
      optionTitle: { fontSize: 13, bold: true, margin: [0, 0, 0, 4] },
      optionDesc: { fontSize: 9.5, color: theme.colors.muted, lineHeight: 1.4 },
      tableLabel: { fontSize: 10, bold: true },
      tableHeader: { fontSize: 7.5, bold: true, margin: [0, 4, 0, 4] },
      accontoText: { fontSize: 9.5, color: theme.colors.muted },
      sectionTitle: { fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
      clauseText: { fontSize: 9.5, lineHeight: 1.5, color: theme.colors.muted },
      footerText: { fontSize: 8.5, color: theme.colors.muted },
    },
    pageMargins: [40, 40, 40, 50],
    info: {
      title: `Preventivo - ${quote.client?.name || 'preventivo'}`,
      author: quote.issuer?.name || 'PrecisionQuote',
    },
  };

  pdfMake.createPdf(docDefinition).download(`${quote.quoteId}_${quote.client?.name || 'preventivo'}.pdf`);
}
