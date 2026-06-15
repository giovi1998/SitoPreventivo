import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfFonts.pdfMake) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
} else {
  pdfMake.vfs = pdfFonts.vfs || pdfFonts;
}

const money = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));

export default function generatePDF(quote) {
  const vat = Number(quote.vat || 22);
  const content = [];

  // ─── TITLE SECTION ───────────────────────────────────
  content.push({
    text: quote.title || 'PREVENTIVO',
    style: 'mainTitle',
    color: quote.color || '#0B57D0',
  });
  content.push({ text: '' }); // spacer

  // Client info table (no borders)
  content.push({
    table: {
      widths: ['*'],
      body: [
        [{ text: `Cliente: ${quote.client || '_________'}`, style: 'clientInfo' }],
        [{ text: `Data: ${quote.date || '_________'}`, style: 'clientInfo' }],
        [{ text: `Preparato da: ${quote.owner || ''}`, style: 'clientInfo' }],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 16],
  });

  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#d7deea' }], margin: [0, 0, 0, 16] });

  // ─── INTRO ───────────────────────────────────────────
  if (quote.intro) {
    const introLines = quote.intro.split('\n').filter(l => l.trim());
    content.push({
      text: introLines.map(line => ({ text: line, style: 'introText' })),
      margin: [0, 0, 0, 16],
    });
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#d7deea' }], margin: [0, 0, 0, 8] });
  }

  // ─── OPTIONS ─────────────────────────────────────────
  quote.options.forEach((option, idx) => {
    if (idx > 0) {
      content.push({ text: '', pageBreak: 'before' });
    }

    const oneTimeVat = option.oneTimeCost * vat / 100;
    const oneTimeTotal = option.oneTimeCost + oneTimeVat;
    const monthlyVat = option.monthlyCost * vat / 100;
    const monthlyTotal = option.monthlyCost + monthlyVat;

    // Option title
    content.push({
      text: option.title,
      style: 'optionTitle',
      color: quote.color || '#0B57D0',
      margin: [0, 0, 0, 8],
    });

    // Description
    content.push({
      text: [{ text: 'Descrizione del progetto\n', bold: true }, option.description || ''],
      style: 'optionDesc',
      margin: [0, 0, 0, 12],
    });

    // Cost table
    const costRows = [
      [{ text: 'Sviluppo sito (una tantum)', style: 'tableHeader' }, { text: 'Importo', style: 'tableHeader', alignment: 'right' }],
      [{ text: 'Sviluppo sito (una tantum)' }, { text: money(option.oneTimeCost), alignment: 'right', bold: true }],
    ];

    if (option.includesMaintenance) {
      costRows.push([{ text: 'Dominio (.it o .com, 1 anno)' }, { text: 'incluso nella manutenzione', alignment: 'right', italics: true }]);
      costRows.push([{ text: 'Hosting (1 anno)' }, { text: 'incluso nella manutenzione', alignment: 'right', italics: true }]);
      costRows.push([{ text: 'Manutenzione mensile' }, { text: money(option.monthlyCost) + '/mese', alignment: 'right', bold: true }]);
    } else {
      costRows.push([{ text: 'Dominio (a carico cliente — indicativo)' }, { text: '~€15–20/anno', alignment: 'right' }]);
      costRows.push([{ text: 'Hosting (a carico cliente — indicativo)' }, { text: '~€60–120/anno', alignment: 'right' }]);
    }

    content.push({ text: 'Costi', style: 'tableLabel', margin: [0, 8, 0, 4] });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: costRows,
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 12],
    });

    // Summary table
    const summaryRows = [
      [
        { text: 'Voce', style: 'tableHeader' },
        { text: 'Imponibile', style: 'tableHeader', alignment: 'right' },
        { text: `IVA ${vat}%`, style: 'tableHeader', alignment: 'right' },
        { text: 'Totale IVA inclusa', style: 'tableHeader', alignment: 'right' },
      ],
      [
        { text: 'Sviluppo (una tantum)' },
        { text: money(option.oneTimeCost), alignment: 'right' },
        { text: money(oneTimeVat), alignment: 'right' },
        { text: money(oneTimeTotal), alignment: 'right', bold: true },
      ],
    ];

    if (option.includesMaintenance) {
      summaryRows.push([
        { text: 'Manutenzione mensile' },
        { text: money(option.monthlyCost), alignment: 'right' },
        { text: money(monthlyVat), alignment: 'right' },
        { text: money(monthlyTotal) + '/mese', alignment: 'right', bold: true },
      ]);
    }

    content.push({ text: 'Riepilogo economico', style: 'tableLabel', margin: [0, 4, 0, 4] });
    content.push({
      table: {
        widths: ['*', 'auto', 'auto', 'auto'],
        body: summaryRows,
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 12],
    });

    // Acconto/Saldo
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e0e5ee' }],
      margin: [0, 4, 0, 4],
    });
    content.push({
      text: [
        { text: 'Acconto sviluppo (50%): ', bold: true },
        { text: money(oneTimeTotal / 2), color: quote.color || '#0B57D0', bold: true },
        { text: ' IVA inclusa  ·  Saldo: ', bold: true },
        { text: money(oneTimeTotal / 2), color: quote.color || '#0B57D0', bold: true },
        { text: ' entro 30 giorni dalla consegna' },
      ],
      style: 'accontoText',
      margin: [0, 0, 0, 8],
    });
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e0e5ee' }],
      margin: [0, 0, 0, 0],
    });
  });

  // ─── CLAUSES ─────────────────────────────────────────
  if (quote.clauses.length > 0) {
    content.push({ text: '', pageBreak: 'before' });
    content.push({ text: 'CLAUSOLE E CONDIZIONI GENERALI', style: 'sectionTitle', margin: [0, 0, 0, 12] });

    quote.clauses.forEach(clause => {
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

  // ─── COMPARISON TABLE ────────────────────────────────
  content.push({ text: '', pageBreak: 'before' });
  content.push({ text: 'RIEPILOGO COMPARATIVO', style: 'sectionTitle', margin: [0, 0, 0, 12] });

  const compHeader = [
    { text: 'Caratteristica', style: 'tableHeader' },
    ...quote.options.map(o => ({ text: o.title.split('—')[0].trim(), style: 'tableHeader' })),
  ];

  const compRows = [
    compHeader,
    [
      { text: 'Tipo sito', bold: true },
      ...quote.options.map(o => ({ text: o.title.includes('WordPress') ? 'WordPress' : 'Su misura' })),
    ],
    [
      { text: 'Manutenzione', bold: true },
      ...quote.options.map(o => ({ text: o.includesMaintenance ? 'Inclusa' : 'Non inclusa' })),
    ],
    [
      { text: 'Costo una tantum', bold: true },
      ...quote.options.map(o => ({ text: money(o.oneTimeCost) })),
    ],
    [
      { text: 'Costo mensile', bold: true },
      ...quote.options.map(o => ({ text: o.monthlyCost > 0 ? money(o.monthlyCost) + '/mese' : '—' })),
    ],
    [
      { text: 'Totale IVA inclusa (primo anno)', bold: true },
      ...quote.options.map(o => {
        const oneTime = o.oneTimeCost * (1 + vat / 100);
        const monthly = o.monthlyCost * 12 * (1 + vat / 100);
        return { text: money(oneTime + monthly), bold: true };
      }),
    ],
  ];

  const compWidths = [130, ...quote.options.map(() => '*')];

  content.push({
    table: {
      widths: compWidths,
      body: compRows,
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 24],
  });

  // ─── FOOTER ──────────────────────────────────────────
  content.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#d7deea' }],
    margin: [0, 0, 0, 8],
  });
  content.push({
    columns: [
      { text: quote.owner || '', width: '*', style: 'footerText' },
      { text: 'Preventivo valido 30 giorni dalla data di emissione.', width: 'auto', style: 'footerText', alignment: 'right' },
    ],
  });

  // ─── DOCUMENT DEFINITION ─────────────────────────────
  const docDefinition = {
    content,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: '#101828',
    },
    styles: {
      mainTitle: { fontSize: 22, bold: true, margin: [0, 0, 0, 4] },
      clientInfo: { fontSize: 10, color: '#39465b', margin: [0, 2, 0, 2] },
      introText: { fontSize: 9.5, color: '#39465b', lineHeight: 1.5 },
      optionTitle: { fontSize: 13, bold: true, margin: [0, 0, 0, 4] },
      optionDesc: { fontSize: 9.5, color: '#39465b', lineHeight: 1.4 },
      tableLabel: { fontSize: 10, bold: true },
      tableHeader: { fontSize: 7.5, bold: true, color: '#344054', margin: [0, 4, 0, 4] },
      accontoText: { fontSize: 9.5, color: '#39465b' },
      sectionTitle: { fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
      clauseText: { fontSize: 9.5, lineHeight: 1.5, color: '#39465b' },
      footerText: { fontSize: 8.5, color: '#687589' },
    },
    pageMargins: [40, 40, 40, 50],
    info: {
      title: `Preventivo - ${quote.client || 'preventivo'}`,
      author: quote.owner || 'PrecisionQuote',
    },
  };

  pdfMake.createPdf(docDefinition).download(`${quote.id}_${quote.client || 'preventivo'}.pdf`);
}
