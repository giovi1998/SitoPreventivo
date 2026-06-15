import React from 'react';
import { money } from '../constants.js';

export default function DocumentPreview({ quote, totals }) {
  const { subtotal, vatAmount, total } = totals;
  return (
    <article className={`document style-${quote.styleId || 'standard'}`} style={{ '--doc-accent': quote.color }}>
      <header className="doc-hero">
        <div>
          <p className="doc-meta">{quote.id} · {quote.date}</p>
          <h2>{quote.title}</h2>
          <p>{quote.intro}</p>
        </div>
        <div className="doc-client"><span>Cliente</span><strong>{quote.client}</strong><small>{quote.contact}</small></div>
      </header>
      <section className="doc-section"><h3>Voci incluse</h3><div className="doc-items">{quote.items.map((item) => <div className="doc-row" key={item.id}><div><strong>{item.description}</strong><p>{item.detail}</p></div><span>{item.qty} × {money(item.rate)}</span></div>)}</div></section>
      <section className="doc-boxes">{quote.sections.map((section) => <div className="doc-box" key={section.id}><h3>{section.title}</h3><p>{section.body}</p></div>)}</section>
      <section className="totals"><div><span>Imponibile</span><b>{money(subtotal)}</b></div><div><span>IVA {quote.vat}%</span><b>{money(vatAmount)}</b></div><div className="grand"><span>Totale</span><b>{money(total)}</b></div></section>
      <footer className="doc-foot"><span>{quote.owner}</span><span>{quote.note}</span></footer>
    </article>
  );
}
