import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, Footer, PageNumber } from 'docx';
import saveAs from 'file-saver';
import type { PremiumQuote, DocumentTemplateId } from './quoteSchema';
import { getTheme } from './documentThemes';

const money = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));

export async function generateDOCX(quote: PremiumQuote, themeId: DocumentTemplateId = 'corporate'): Promise<void> {
  const theme = getTheme(themeId);
  const accent = quote.uiPreferences?.accentColor || '#01696F';
  const opts = quote.options || [];

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: quote.project?.title || 'PREVENTIVO',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    })
  );

  // Client info
  children.push(
    new Paragraph({ children: [new TextRun({ text: `Cliente: ${quote.client?.name || '_________'}`, size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: `Data: ${(quote.createdAt || '').slice(0, 10)}`, size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: `Preparato da: ${quote.issuer?.name || ''}`, size: 20 })], spacing: { after: 400 } })
  );

  // Horizontal rule
  children.push(new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: theme.colors.border } } }));

  // Description
  if (quote.project?.description) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: quote.project.description, size: 20 })],
        spacing: { after: 400 },
      })
    );
    children.push(new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: theme.colors.border } } }));
  }

  // Options
  opts.forEach((option) => {
    const items = option.items || [];

    children.push(
      new Paragraph({
        children: [new TextRun({ text: option.label, size: 24, bold: true, color: accent })],
        spacing: { before: 400, after: 200 },
      })
    );

    if (option.description) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Descrizione del progetto', bold: true, size: 20 }), new TextRun({ text: `\n${option.description}`, size: 20 })],
          spacing: { after: 200 },
        })
      );
    }

    if (items.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Costi', bold: true, size: 20 })],
          spacing: { after: 100 },
        })
      );

      const costTableRows: TableRow[] = [];
      costTableRows.push(
        new TableRow({
          tableHeader: true,
          children: ['Voce', 'Q.tà', 'Prezzo', 'Totale'].map((h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: theme.colors.headerText })], alignment: h === 'Voce' ? AlignmentType.LEFT : AlignmentType.RIGHT })],
              shading: { fill: theme.colors.primary },
            })
          ),
        })
      );

      items.forEach((item) => {
        costTableRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.label, size: 18 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${item.quantity} ${item.unit}`, size: 18 })], alignment: AlignmentType.RIGHT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: money(item.unitPrice), size: 18 })], alignment: AlignmentType.RIGHT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: money(item.total?.gross || 0), size: 18, bold: true })], alignment: AlignmentType.RIGHT })] }),
            ],
          })
        );
      });

      children.push(
        new Table({
          rows: costTableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );

      // Summary
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Riepilogo economico', bold: true, size: 20 })],
          spacing: { before: 200, after: 100 },
        })
      );

      const sumRows: TableRow[] = [];
      sumRows.push(
        new TableRow({
          tableHeader: true,
          children: ['Voce', 'Imponibile', `IVA ${items[0]?.tax?.rate || 22}%`, 'Totale IVA inclusa'].map((h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: theme.colors.headerText })], alignment: h === 'Voce' ? AlignmentType.LEFT : AlignmentType.RIGHT })],
              shading: { fill: theme.colors.primary },
            })
          ),
        })
      );

      items.forEach((item) => {
        sumRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.label, size: 18 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: money(item.total?.net || 0), size: 18 })], alignment: AlignmentType.RIGHT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: money(item.total?.tax || 0), size: 18 })], alignment: AlignmentType.RIGHT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: money(item.total?.gross || 0), size: 18, bold: true })], alignment: AlignmentType.RIGHT })] }),
            ],
          })
        );
      });

      sumRows.push(
        new TableRow({
          children: ['Totale opzione', money(option.summary?.totalNet || 0), money(option.summary?.taxTotal || 0), money(option.summary?.totalGross || 0)].map((t, i) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: t, size: 18, bold: true })], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })],
            })
          ),
        })
      );

      children.push(
        new Table({
          rows: sumRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
    }

    // Payment schedule
    if (quote.paymentTerms?.paymentSchedule?.length > 0) {
      quote.paymentTerms.paymentSchedule.forEach((ps) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${ps.label} (${ps.percentage}%): `, bold: true, size: 20 }),
              new TextRun({ text: `${money((option.summary?.totalGross || 0) * ps.percentage / 100)} IVA inclusa`, bold: true, size: 20, color: accent }),
              new TextRun({ text: `, ${ps.notes || `Entro ${ps.dueDaysFromIssue} giorni`}`, size: 20 }),
            ],
            spacing: { before: 200 },
          })
        );
      });
    }
  });

  // Clauses
  if (quote.legalClauses?.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'CLAUSOLE E CONDIZIONI GENERALI', size: 24, bold: true })],
        spacing: { before: 600, after: 200 },
        pageBreakBefore: true,
      })
    );

    quote.legalClauses.forEach((clause) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: clause.title, bold: true, size: 20 }),
            new TextRun({ text: `\n${clause.body}`, size: 20 }),
          ],
          spacing: { after: 200 },
        })
      );
    });
  }

  // Comparison
  if (opts.length > 1) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'RIEPILOGO COMPARATIVO', size: 24, bold: true })],
        spacing: { before: 600, after: 200 },
        pageBreakBefore: true,
      })
    );

    const compRows: TableRow[] = [];
    compRows.push(
      new TableRow({
        tableHeader: true,
        children: [{ text: 'Caratteristica', bold: true, size: 18 }, ...opts.map((o) => ({ text: o.label.split(':')[0].trim(), bold: true, size: 18 }))].map((h, i) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h.text, bold: true, size: 18 })], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })],
          })
        ),
      })
    );

    const compData = [
      ['Totale NET', ...opts.map((o) => money(o.summary?.totalNet || 0))],
      ['Totale IVA', ...opts.map((o) => money(o.summary?.taxTotal || 0))],
      ['Totale IVA inclusa', ...opts.map((o) => money(o.summary?.totalGross || 0))],
    ];

    compData.forEach((row) => {
      compRows.push(
        new TableRow({
          children: row.map((cell, i) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18, bold: i === 0 || row[0] === 'Totale IVA inclusa' })], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })],
            })
          ),
        })
      );
    });

    children.push(
      new Table({
        rows: compRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  // Footer
  const doc = new Document({
    sections: [{
      properties: {},
      children,
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: quote.issuer?.name || '', size: 16 }),
                new TextRun({ text: `\tPreventivo valido fino al ${quote.validUntil || '30 giorni'}`, size: 16 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${quote.quoteId}_${quote.client?.name || 'preventivo'}.docx`);
}
