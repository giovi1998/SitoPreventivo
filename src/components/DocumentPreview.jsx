import React from 'react';

const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));

const DocumentPreview = React.memo(React.forwardRef(function DocumentPreview({ quote }, ref) {
  const vat = Number(quote.vat || 22);

  return (
    <article ref={ref} className="document" style={{ '--doc-accent': quote.color }}>

      {/* Title section */}
      <div className="doc-title-section">
        <h1 className="doc-main-title" style={{ color: quote.color }}>{quote.title || 'PREVENTIVO'}</h1>
        <div className="doc-client-info">
          <p><strong>Cliente:</strong> {quote.client || '_________'}</p>
          <p><strong>Data:</strong> {quote.date || '_________'}</p>
          <p><strong>Preparato da:</strong> {quote.owner}</p>
        </div>
      </div>

      {/* Intro text */}
      {quote.intro && (
        <div className="doc-intro-text">
          {quote.intro.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      {/* Options */}
      {quote.options.map((option, idx) => {
        const oneTimeVat = option.oneTimeCost * vat / 100;
        const oneTimeTotal = option.oneTimeCost + oneTimeVat;
        const monthlyVat = option.monthlyCost * vat / 100;
        const monthlyTotal = option.monthlyCost + monthlyVat;

        return (
          <div key={option.id} className="doc-option" style={idx > 0 ? { pageBreakBefore: 'always' } : undefined}>
            <h2 className="doc-option-title" style={{ color: quote.color }}>{option.title}</h2>
            <p className="doc-option-desc-label"><strong>Descrizione del progetto</strong></p>
            <p className="doc-option-desc">{option.description}</p>

            {/* Cost table */}
            <p className="doc-table-label"><strong>Costi</strong></p>
            <table className="doc-cost-table">
              <tbody>
                <tr>
                  <td>Sviluppo sito (una tantum)</td>
                  <td>{money(option.oneTimeCost)}</td>
                </tr>
                {option.includesMaintenance ? (
                  <>
                    <tr>
                      <td>Dominio (.it o .com, 1 anno)</td>
                      <td>incluso nella manutenzione</td>
                    </tr>
                    <tr>
                      <td>Hosting (1 anno)</td>
                      <td>incluso nella manutenzione</td>
                    </tr>
                    <tr>
                      <td>Manutenzione mensile</td>
                      <td>{money(option.monthlyCost)}/mese</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td>Dominio (a carico cliente — indicativo)</td>
                      <td>~€15–20/anno</td>
                    </tr>
                    <tr>
                      <td>Hosting (a carico cliente — indicativo)</td>
                      <td>~€60–120/anno</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* Summary table */}
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
                <tr>
                  <td>Sviluppo (una tantum)</td>
                  <td>{money(option.oneTimeCost)}</td>
                  <td>{money(oneTimeVat)}</td>
                  <td>{money(oneTimeTotal)}</td>
                </tr>
                {option.includesMaintenance && (
                  <tr>
                    <td>Manutenzione mensile</td>
                    <td>{money(option.monthlyCost)}</td>
                    <td>{money(monthlyVat)}</td>
                    <td>{money(monthlyTotal)}/mese</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Acconto */}
            <div className="doc-acconto-section">
              <p>
                Acconto sviluppo (50%): <strong style={{ color: quote.color }}>{money(oneTimeTotal / 2)}</strong> IVA inclusa · Saldo: <strong style={{ color: quote.color }}>{money(oneTimeTotal / 2)}</strong> entro 30 giorni dalla consegna
              </p>
            </div>
          </div>
        );
      })}

      {/* Clauses */}
      {quote.clauses.length > 0 && (
        <div className="doc-clauses-section" style={{ pageBreakBefore: 'always' }}>
          <h2 className="doc-clauses-title">CLAUSOLE E CONDIZIONI GENERALI</h2>
          {quote.clauses.map(clause => (
            <div key={clause.id} className="doc-clause">
              <p><strong>{clause.title}</strong><br />{clause.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Comparative summary */}
      <div className="doc-comparison-section" style={{ pageBreakBefore: 'always' }}>
        <h2 className="doc-comparison-title">RIEPILOGO COMPARATIVO</h2>
        <div className="doc-comparison-wrap">
          <table className="doc-comparison-table">
            <thead>
              <tr>
                <th>Caratteristica</th>
                {quote.options.map(o => <th key={o.id}>{o.title.split('—')[0].trim()}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tipo sito</td>
                {quote.options.map(o => <td key={o.id}>{o.title.includes('WordPress') ? 'WordPress' : 'Su misura'}</td>)}
              </tr>
              <tr>
                <td>Manutenzione</td>
                {quote.options.map(o => <td key={o.id}>{o.includesMaintenance ? 'Inclusa' : 'Non inclusa'}</td>)}
              </tr>
              <tr>
                <td>Costo una tantum</td>
                {quote.options.map(o => <td key={o.id}>{money(o.oneTimeCost)}</td>)}
              </tr>
              <tr>
                <td>Costo mensile</td>
                {quote.options.map(o => <td key={o.id}>{o.monthlyCost > 0 ? money(o.monthlyCost) + '/mese' : '—'}</td>)}
              </tr>
              <tr>
                <td>Totale IVA inclusa (primo anno)</td>
                {quote.options.map(o => {
                  const vat = Number(quote.vat || 22);
                  const oneTime = o.oneTimeCost * (1 + vat / 100);
                  const monthly = o.monthlyCost * 12 * (1 + vat / 100);
                  return <td key={o.id}><strong>{money(oneTime + monthly)}</strong></td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer className="doc-footer">
        <span>{quote.owner}</span>
        <span>Preventivo valido 30 giorni dalla data di emissione.</span>
      </footer>
    </article>
  );
}), (prev, next) => {
  const p = prev.quote, n = next.quote;
  return p.title === n.title && p.client === n.client && p.color === n.color
    && p.intro === n.intro && p.vat === n.vat && p.owner === n.owner && p.date === n.date
    && p.options === n.options && p.clauses === n.clauses;
});

export default DocumentPreview;
