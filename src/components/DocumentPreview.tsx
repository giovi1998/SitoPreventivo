import React from 'react';
import type { PremiumQuote, DocumentTemplateId } from '../utils/quoteSchema';
import { getThemeStyles } from '../utils/documentThemes';

const money = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

const renderTextWithCallouts = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\[WARNING\][\s\S]*?\[\/WARNING\]|\[INFO\][\s\S]*?\[\/INFO\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('[WARNING]')) {
      const content = part.replace(/\[\/?WARNING\]/g, '').trim();
      return <div key={i} className="doc-callout-warning"><strong>⚠ Attenzione:</strong> {content}</div>;
    }
    if (part.startsWith('[INFO]')) {
      const content = part.replace(/\[\/?INFO\]/g, '').trim();
      return <div key={i} className="doc-callout-info"><strong>✅ Nota:</strong> {content}</div>;
    }
    if (!part.trim()) return null;
    return (
      <div key={i}>
        {part.split('\n').map((line, j) => line.trim() ? <p key={`${i}-${j}`}>{line}</p> : null)}
      </div>
    );
  });
};

interface DocumentPreviewProps {
  quote: PremiumQuote;
  documentTheme?: DocumentTemplateId;
}

const DocumentPreview = React.memo(React.forwardRef<HTMLElement, DocumentPreviewProps>(
  function DocumentPreview({ quote, documentTheme = 'corporate' }, ref) {
    const themeClass = `doc-theme-${documentTheme}`;
    const opts = quote.options || [];
    const accent = quote.uiPreferences?.accentColor || '#01696F';
    const fontFamily = documentTheme === 'creative' ? "'Source Serif 4', Georgia, serif" : "'Inter', system-ui, sans-serif";

    const style = {
      '--doc-accent': accent,
      fontFamily,
    } as React.CSSProperties;

    return (
      <article ref={ref} className={`document ${themeClass}`} style={style}>

        <div className="doc-title-section">
          <h1 className="doc-main-title" style={{ color: accent }}>
            {quote.project?.title || 'PREVENTIVO'}
          </h1>
          <div className="doc-client-info">
            <p><strong>Cliente:</strong> {quote.client?.name || '_________'}</p>
            <p><strong>Data:</strong> {quote.createdAt?.slice(0, 10) || '_________'}</p>
            <p><strong>Preparato da:</strong> {quote.issuer?.name}</p>
          </div>
        </div>

        {quote.project?.description && (
          <div className="doc-intro-text">
            {renderTextWithCallouts(quote.project.description)}
          </div>
        )}

        {opts.map((option, idx) => {
          const items = option.items || [];
          const vat = items[0]?.tax?.rate || 22;

          return (
            <div key={option.id} className="doc-option" style={idx > 0 ? { pageBreakBefore: 'always' } : undefined}>
              <h2 className="doc-option-title" style={{ color: accent }}>{option.label}</h2>
              {option.description && (
                <>
                  <p className="doc-option-desc-label"><strong>Descrizione del progetto</strong></p>
                  <div className="doc-option-desc">{renderTextWithCallouts(option.description)}</div>
                </>
              )}

              {items.length > 0 && (
                <>
                  <p className="doc-table-label"><strong>Costi</strong></p>
                  <table className="doc-cost-table">
                    <thead>
                      <tr>
                        <th>Voce</th>
                        <th>Q.tà</th>
                        <th>Prezzo</th>
                        <th>Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.label}</td>
                          <td>{item.quantity} {item.unit}</td>
                          <td>{money(item.unitPrice)}</td>
                          <td>{money(item.total?.gross || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="doc-table-label"><strong>Riepilogo economico</strong></p>
                  <table className="doc-summary-table">
                    <thead>
                      <tr>
                        <th>Voce</th>
                        <th>Imponibile</th>
                        <th>IVA {vat}%</th>
                        <th>Totale IVA inclusa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.label}</td>
                          <td>{money(item.total?.net || 0)}</td>
                          <td>{money(item.total?.tax || 0)}</td>
                          <td>{money(item.total?.gross || 0)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td><strong>Totale opzione</strong></td>
                        <td><strong>{money(option.summary?.totalNet || 0)}</strong></td>
                        <td><strong>{money(option.summary?.taxTotal || 0)}</strong></td>
                        <td><strong>{money(option.summary?.totalGross || 0)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}

              {(quote.paymentTerms?.paymentSchedule?.length > 0) && (
                <div className="doc-acconto-section">
                  {quote.paymentTerms.paymentSchedule.map((ps, i) => (
                    <p key={i}>
                      <strong style={{ color: accent }}>{ps.label} ({ps.percentage}%):</strong>{' '}
                      {money((option.summary?.totalGross || 0) * ps.percentage / 100)} IVA inclusa
                      {' — '}{ps.notes || `Entro ${ps.dueDaysFromIssue} giorni`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {quote.legalClauses?.length > 0 && (
          <div className="doc-clauses-section" style={{ pageBreakBefore: 'always' }}>
            <h2 className="doc-clauses-title">CLAUSOLE E CONDIZIONI GENERALI</h2>
            {quote.legalClauses.map((clause) => (
              <div key={clause.id} className="doc-clause">
                <p><strong>{clause.title}</strong></p>
                {renderTextWithCallouts(clause.body)}
              </div>
            ))}
          </div>
        )}

        {opts.length > 1 && (
          <div className="doc-comparison-section" style={{ pageBreakBefore: 'always' }}>
            <h2 className="doc-comparison-title">RIEPILOGO COMPARATIVO</h2>
            <div className="doc-comparison-wrap">
              <table className="doc-comparison-table">
                <thead>
                  <tr>
                    <th>Caratteristica</th>
                    {opts.map((o) => <th key={o.id}>{o.label.split('—')[0].trim()}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Totale NET</td>
                    {opts.map((o) => <td key={o.id}>{money(o.summary?.totalNet || 0)}</td>)}
                  </tr>
                  <tr>
                    <td>Totale IVA</td>
                    {opts.map((o) => <td key={o.id}>{money(o.summary?.taxTotal || 0)}</td>)}
                  </tr>
                  <tr>
                    <td><strong>Totale IVA inclusa</strong></td>
                    {opts.map((o) => <td key={o.id}><strong>{money(o.summary?.totalGross || 0)}</strong></td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <footer className="doc-footer">
          <span>{quote.issuer?.name || ''}</span>
          <span>Preventivo valido fino al {quote.validUntil || '30 giorni'}</span>
        </footer>
      </article>
    );
  }
), (prev, next) => {
  return prev.quote === next.quote && prev.documentTheme === next.documentTheme;
});

export default DocumentPreview;
